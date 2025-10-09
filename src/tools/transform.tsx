import { TransformControls, TransformControlsProps } from '@react-three/drei'
import { useSelectionInfo } from './select.js'
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { createContext, DependencyList, memo, PropsWithChildren, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MultiSelect, Select } from '../ui/select.js'
import { Toolbar } from '../ui/toolbar.js'
import { isDescendantOf, Parented } from '../utils/parented.js'
import { useItemEffect, useObservableList } from '../utils/observable-list.js'
import { useThree } from '@react-three/fiber'
import { ObservableList } from '@code-essentials/utils'
import { Checkbox } from '@mui/material'
import { useObjectInteractionEvent } from './interactive.js'
import { TransformControls as TransformControlsImpl } from 'three-stdlib'
import { EventArgs } from './interactive.js'

export class TransformInfo {
    readonly listeners: {
        [K in keyof TransformEvents]: TransformEvents[K][]
    } = {
        start: [],
        complete: [],
        transform: [],
    }
}

export interface TransformEvents {
    /**
     * user started transforming an object
     * 
     * @param object object user is directly transformed
     */
    start(object: Object3D): void

    /**
     * user completed transforming an object
     * 
     * other objects could copy the transform
     * 
     * @param object object user is directly transformed
     * @param transform accumulated transform
     */
    complete(object: Object3D, transform: Matrix4): void

    /**
     * user has transformed object
     * 
     * @param object object user is directly transforming
     * @param transform accumulated transform
     */
    transform(object: Object3D, transform: Matrix4): void
}

const transformInfoContext = createContext<TransformInfo | undefined>(undefined)

export function TransformInfoProvider({ children }: PropsWithChildren) {
    const transformInfo = useMemo<TransformInfo>(() => new TransformInfo(), [])
    return (
        <transformInfoContext.Provider value={transformInfo}>
            {children}
        </transformInfoContext.Provider>
    )
}

export function useTransformInfo() {
    const transformInfo = useContext(transformInfoContext)
    if (!transformInfo)
        throw new Error('useTransformInfo must be used within a TransformInfoProvider')
    return transformInfo
}

export function useTransformListener<K extends keyof TransformEvents>(event: K, callback: TransformEvents[K], deps?: DependencyList) {
    const transformInfo = useTransformInfo()
    useEffect(() => {
        transformInfo.listeners[event].push(callback)
        return () => {
            const index = transformInfo.listeners[event].indexOf(callback)
            if (index !== -1)
                transformInfo.listeners[event].splice(index, 1)
        }
    }, [transformInfo, callback, ...(deps ?? [])])
}

export function useIsTransforming() {
    const transformInfo = useTransformInfo()
    const [isTransforming, setIsTransforming] = useState(false)
    useEffect(() => {
        const start = () => setIsTransforming(true)
        const complete = () => setIsTransforming(false)
        transformInfo.listeners.start.push(start)
        transformInfo.listeners.complete.push(complete)
        return () => {
            const index1 = transformInfo.listeners.start.indexOf(start)
            if (index1 !== -1) transformInfo.listeners.start.splice(index1, 1)
            const index2 = transformInfo.listeners.complete.indexOf(complete)
            if (index2 !== -1) transformInfo.listeners.complete.splice(index2, 1)
        }
    }, [transformInfo])
    return isTransforming
}

export enum TransformCoordinateSystem {
    local = 'local',
    global = 'global',
}

export enum TransformControlsPosition {
    average = 'average',
    each = 'each',
    first = 'first',
    last = 'last',
}

export interface TransformType {
    translate: boolean
    rotate: boolean
    scale: boolean
}

export interface TransformToolProps {
    objects: ObservableList<Object3D>
    controlsPosition: TransformControlsPosition
    coordinateSystem: TransformCoordinateSystem
    transformType: Readonly<TransformType>
}

export function TransformTool(props: TransformToolProps) {
    switch(props.controlsPosition) {
        case TransformControlsPosition.average:
            return <TransformTool_average {...props} />
        case TransformControlsPosition.each:
            return <TransformTool_each {...props} />
        case TransformControlsPosition.first:
            return <TransformTool_first {...props} />
        case TransformControlsPosition.last:
            return <TransformTool_last {...props} />
    }
}

const TransformTool_first = memo((props: TransformToolProps) => {
    const { objects, ...transformComponentProps } = props
    const object = useObservableList(objects).at(0)
    if (!object)
        return null

    return <TransformComponent object={object} {...transformComponentProps} />
})

const TransformTool_last = memo((props: TransformToolProps) => {
    const { objects, ...transformComponentProps } = props
    const object = useObservableList(objects).at(-1)
    if (!object)
        return null

    return <TransformComponent object={object} {...transformComponentProps} />
})

const TransformTool_each = memo((props: TransformToolProps) => {
    const { objects, ...transformComponentProps } = props
    const objects_ = useObservableList(objects)

    return (
        <group name="transform-tools">
            {objects_.map(object => <TransformComponent key={object.uuid} object={object} {...transformComponentProps} />)}
        </group>
    )
})

const TransformTool_average = memo((props: TransformToolProps) => {
    const average_ref = useRef<Object3D | null>(null)
    const [average_resolved, average_setResolved] = useState<Object3D | null>(average_ref.current)
    useEffect(() => {
        const p = average_ref.current
        if (p)
            average_setResolved(p)
        else {
            // Wait until the ref is assigned
            const id = requestAnimationFrame(() => {
                if (average_ref.current) average_setResolved(average_ref.current)
            })
            return () => cancelAnimationFrame(id)
        }
    }, [])

    const updateAverage = useCallback(() => {
        const average = average_ref.current
        if (!average || props.objects.length === 0)
            return

        const average_pos = new Vector3()
        const average_quat = new Quaternion(0, 0, 0, 0)
        const average_scale = new Vector3()
        
        for (const object of props.objects) {
            average_pos.add(object.getWorldPosition(new Vector3()))

            const objQuat = object.getWorldQuaternion(new Quaternion())
            average_quat.x += objQuat.x
            average_quat.y += objQuat.y
            average_quat.z += objQuat.z
            average_quat.w += objQuat.w

            average_scale.add(object.getWorldScale(new Vector3()))
        }

        average_quat.normalize()
        average_pos.divideScalar(props.objects.length)
        average_scale.divideScalar(props.objects.length)
                
        average.position.copy(average_pos)
        average.quaternion.copy(average_quat)
        average.scale.copy(average_scale)
    }, [props.objects])

    useTransformListener('transform', updateAverage)
    useItemEffect(props.objects, updateAverage)
    useLayoutEffect(updateAverage)

    return (
        <>
            <object3D ref={average_ref} />
            {average_resolved && <TransformComponent object={average_resolved} {...props} />}
        </>
    )
})

export interface EditorTransformControlsProps {
}

function computeIslands(objects: ObservableList<Object3D>): Object3D[] {
    const islands: Object3D[] = []
    
    for (const object of objects)
        if (!islands.some(island => isDescendantOf(object, island)))
            islands.push(object)
    
    return islands
}

function useIslands(objects: ObservableList<Object3D>) {
    const islands = useMemo(() => new ObservableList<Object3D>(...computeIslands(objects)), [])
    
    useItemEffect(objects, object => {
        if (islands.includes(object))
            return

        // if this object is not a descendant of any other island, it's an island
        if (islands.some(island => isDescendantOf(object, island)))
            return

        islands.push(object)

        // remove islands that are no longer islands
        for (let i = 0; i < islands.length; i++) {
            const island = islands[i]!
            if (isDescendantOf(island, object))
                islands.splice(i--, 1)
        }

        return () => {
            // objects eligible for island d/t item object removed
            const objectsNowIslands = objects.filter(child => isDescendantOf(child, object))
            // remove objects that are children of another object in objectsNowIslands
            for (let i = 0; i < objectsNowIslands.length; i++) {
                const objectNowIsland = objectsNowIslands[i]
                if (objectsNowIslands.some(otherObjNowIsland => isDescendantOf(objectNowIsland, otherObjNowIsland)))
                    objectsNowIslands.splice(i--, 1)
            }

            const index = islands.indexOf(object)
            if (index !== -1)
                islands.splice(index, 1, ...objectsNowIslands)
        }
    }, [], 'islands')

    return islands
}

function useTransformableObjects(islandTransform: boolean) {
    const selection = useSelectionInfo().selection
    const islands = useIslands(selection)

    return islandTransform ? islands : selection
}

function useApplyTransform(objects: ObservableList<Object3D>, coordinateSystem: TransformCoordinateSystem) {
    // only in local coordinate system (relative to parent)
    const objects_transformStart = useRef(new Map<Object3D, Matrix4>())
    const currentTransformDirectlyTransformedObjects = useRef(new Set<Object3D>())

    const coordinateSystem_ref = useRef(coordinateSystem)
    useEffect(() => {
        coordinateSystem_ref.current = coordinateSystem
    }, [coordinateSystem])

    useItemEffect(objects, object => {
        objects_transformStart.current.set(object, object.matrix.clone())

        return () => {
            objects_transformStart.current.delete(object)
            currentTransformDirectlyTransformedObjects.current.delete(object)
        }
    })

    useTransformListener('start', directlyTransformedObj => {
        console.log(`transform started for ${directlyTransformedObj.name} (${directlyTransformedObj.uuid})`)
        objects_transformStart.current.set(directlyTransformedObj, directlyTransformedObj.matrix.clone())
        currentTransformDirectlyTransformedObjects.current.add(directlyTransformedObj)
    }, [objects])

    const applyTransform = useCallback((transform: Matrix4) => {
        for (const object of objects) {
            if (!currentTransformDirectlyTransformedObjects.current.has(object)) {
                console.log(`applying transform to ${object.name} (${object.uuid})`)
                const transformStart = objects_transformStart.current.get(object)
                if (!transformStart)
                    throw new Error("indirectly transformed object's start transform not found")

                const deltaTransform = getDeltaTransform(object, coordinateSystem_ref.current, transform)
                const transformEnd = transformStart.clone().multiply(deltaTransform)
                setObjectTransform(object, transformEnd)
            }
        }
    }, [objects])

    useTransformListener('transform', (_, transform) => {
        applyTransform(transform)
    }, [objects, applyTransform])

    const isTransforming = useIsTransforming()
    useEffect(() => {
        if (!isTransforming)
            currentTransformDirectlyTransformedObjects.current.clear()
    }, [isTransforming])

    // useTransformListener('complete', (directlyTransformedObj, transform) => {
    //     applyTransform(transform)
    //     console.log(`transform complete for ${directlyTransformedObj.name} (${directlyTransformedObj.uuid})`)
    //     currentTransformDirectlyTransformedObjects.current.delete(directlyTransformedObj)
    // }, [objects, applyTransform])
}

export function EditorTransformControls({ }: EditorTransformControlsProps) {
    const [controlsPosition, setTransformOrigin] = useState<TransformControlsPosition>(TransformControlsPosition.first)
    const [coordinateSystem, setCoordinateSystem] = useState<TransformCoordinateSystem>(TransformCoordinateSystem.local)
    const [transformType, setTransformType] = useState<TransformType>({
        translate: true,
        rotate: false,
        scale: false,
    })
    const [islandTransform, setIslandTransform] = useState<boolean>(true)
    const onIslandTransformCheckChanged = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setIslandTransform(event.target.checked)
    }, [setIslandTransform])

    const setTransformTypeFromValue = useCallback((value: string[]) => {
        setTransformType({
            translate: value.includes('translate'),
            rotate: value.includes('rotate'),
            scale: value.includes('scale'),
        })
    }, [setTransformType])

    const valuesForTransformType = useMemo(() => {
        const values: string[] = []
        if (transformType.translate)
            values.push('translate')
        if (transformType.rotate)
            values.push('rotate')
        if (transformType.scale)
            values.push('scale')
        return values
    }, [transformType])

    const objects = useTransformableObjects(islandTransform)
    useApplyTransform(objects, coordinateSystem)
    
    return (
        <>
            <TransformTool
                objects={objects}
                controlsPosition={controlsPosition}
                transformType={transformType}
                coordinateSystem={coordinateSystem}
            />
            <Toolbar>
                <Select
                    items={[
                        {
                            value: TransformCoordinateSystem.global,
                            text: 'Global',
                            icon: <>G</>,
                        },
                        {
                            value: TransformCoordinateSystem.local,
                            text: 'Local',
                            icon: <>L</>,
                        },
                    ]}
                    value={coordinateSystem}
                    onChange={value => setCoordinateSystem(value as TransformCoordinateSystem)}
                />
                <Select
                    items={[
                        {
                            value: TransformControlsPosition.average,
                            text: 'Average',
                            icon: <>A</>,
                        },
                        {
                            value: TransformControlsPosition.each,
                            text: 'Each',
                            icon: <>E</>,
                        },
                        {
                            value: TransformControlsPosition.first,
                            text: 'First',
                            icon: <>F</>,
                        },
                        {
                            value: TransformControlsPosition.last,
                            text: 'Last',
                            icon: <>L</>,
                        },
                    ]}
                    value={controlsPosition}
                    onChange={value => setTransformOrigin(value as TransformControlsPosition)}
                />
                <MultiSelect
                    items={[
                        {
                            value: 'translate',
                            text: 'Translate',
                            icon: <>T</>,
                        },
                        {
                            value: 'rotate',
                            text: 'Rotate',
                            icon: <>R</>,
                        },
                        {
                            value: 'scale',
                            text: 'Scale',
                            icon: <>S</>,
                        },
                    ]}
                    value={valuesForTransformType}
                    onChange={setTransformTypeFromValue}
                />
                <Checkbox
                    // icon={null}
                    content='Island transform'
                    checked={islandTransform}
                    onChange={onIslandTransformCheckChanged}
                />
            </Toolbar>
        </>
    )
}

interface TransformComponentProps {
    object: Object3D

    coordinateSystem: TransformCoordinateSystem
    transformType: Readonly<TransformType>
}

function getCurrentTransform(object: Object3D, coordinateSystem: TransformCoordinateSystem) {
    switch (coordinateSystem) {
        case TransformCoordinateSystem.local:
            return object.matrix.clone()
        case TransformCoordinateSystem.global:
            return object.matrixWorld.clone()
    }
}

function getDeltaTransform(object: Object3D, coordinateSystem: TransformCoordinateSystem, transform: Matrix4) {
    switch (coordinateSystem) {
        case TransformCoordinateSystem.local:
            return transform
        case TransformCoordinateSystem.global:
            //TODO: convert deltaTransform to local coordinates
            // extract only 3x3 rotation/scale part of matrixWorld
            const localTransform = transform.clone().premultiply(
                object.matrixWorld.clone()
                    .setPosition(new Vector3())
                    .invert()
            )

            return localTransform
    }
}

function setObjectTransform(object: Object3D, matrix: Matrix4) {
    matrix.decompose(object.position, object.quaternion, object.scale)
}

function TransformComponent({ object, coordinateSystem, transformType }: TransformComponentProps) {
    const transformInfo = useTransformInfo()
    const selectionInfo = useSelectionInfo()

    const startTransform = useRef<Matrix4 | null>(null)

    const onStart = useCallback(() => {
        if (!object)
            return
        
        selectionInfo.disabled = true

        startTransform.current = getCurrentTransform(object, coordinateSystem)
        for (const listener of transformInfo.listeners.start)
            listener(object)
    }, [object, transformInfo, coordinateSystem])

    const onComplete = useCallback(() => {
        if (!object)
            return
        
        if (!startTransform.current)
            return

        const endTransform = getCurrentTransform(object, coordinateSystem)
        const deltaTransform = endTransform.invert().multiply(startTransform.current)
        startTransform.current = null

        setTimeout(() => selectionInfo.disabled = false, 100)

        for (const listener of transformInfo.listeners.complete)
            listener(object, deltaTransform)
    }, [object, transformInfo, coordinateSystem])

    const onTransform = useCallback(() => {
        if (!object)
            return

        if (!startTransform.current)
            return

        const endTransform = getCurrentTransform(object, coordinateSystem)
        const deltaTransform = endTransform.clone().invert().multiply(startTransform.current)
        startTransform.current = endTransform.clone()

        for (const listener of transformInfo.listeners.transform)
            listener(object, deltaTransform)
    }, [transformInfo, object, coordinateSystem])

    const space: TransformControlsProps['space'] = coordinateSystem === TransformCoordinateSystem.global ? 'world' : 'local'
    const scene = useThree(s => s.scene)

    const transformControlRef_translate = useRef<TransformControlsImpl|null>(null)
    const transformControlRef_rotate = useRef<TransformControlsImpl|null>(null)
    const transformControlRef_scale = useRef<TransformControlsImpl|null>(null)

    //TODO: gizmo is not in intersection result
    const onGizmoEvent = useCallback((...[e]: EventArgs['onClick' | 'onPointerDown' | 'onPointerUp']) => {
        if (e?.object === transformControlRef_translate.current ||
            e?.object === transformControlRef_rotate.current ||
            e?.object === transformControlRef_scale.current)
            e.stopPropagation()
    }, [transformControlRef_translate, transformControlRef_rotate, transformControlRef_scale])

    useObjectInteractionEvent(scene, 'onClick', onGizmoEvent)
    useObjectInteractionEvent(scene, 'onPointerDown', onGizmoEvent)
    useObjectInteractionEvent(scene, 'onPointerUp', onGizmoEvent)

    return (
        <Parented parent={scene}>
            {transformType.translate && object && <TransformControls
                ref={transformControlRef_translate}
                key='translate'
                object={object}
                mode='translate'
                space={space}
                onMouseDown={onStart}
                onMouseUp={onComplete}
                onChange={onTransform} />}
            {transformType.rotate && object && <TransformControls
                ref={transformControlRef_rotate}
                key='rotate'
                object={object}
                mode='rotate'
                space={space}
                onMouseDown={onStart}
                onMouseUp={onComplete}
                onChange={onTransform} />}
            {transformType.scale && object && <TransformControls
                ref={transformControlRef_scale}
                key='scale'
                object={object}
                mode='scale'
                space={space}
                onMouseDown={onStart}
                onMouseUp={onComplete}
                onChange={onTransform} />}
        </Parented>
    )
}
