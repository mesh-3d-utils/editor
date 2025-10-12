import { TransformControls as TransformControlsImpl, TransformControlsProps as TransformControlsImplProps } from '@react-three/drei'
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { memo, RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MultiSelect, Select } from '../ui/select.js'
import { Toolbar } from '../ui/toolbar.js'
import { isDescendantOf, Parented } from '../utils/parented.js'
import { useItemEffect, useObservableList } from '../utils/observable-list.js'
import { useThree } from '@react-three/fiber'
import { ObservableList } from '@code-essentials/utils'
import { Checkbox } from '@mui/material'
import { TransformControls as TransformControlsImpl2 } from 'three-stdlib'
import { dispatchEventBubbled, EventMapBubbles, useEvent, usePointerEventsIgnored } from '../utils/interactive.js'
import { SelectableInfo, useGlobalSelectable, useSelectControlsInfo, useSelection } from './select.js'

declare module 'three' {
    interface Object3DEventMap extends EventMapBubbles<true, TransformEventParameters> { }
}

interface TransformEventParameters {
    /**
     * user started transforming an object
     */
    onTransformStart: {}

    /**
     * user completed transforming an object
     * 
     * other objects could copy the transform
     */
    onTransformComplete: {
        /** accumulated transform */
        transform: Matrix4
    }

    /**
     * user has transformed object
     */
   onTransform: {
       /** accumulated transform */
       transform: Matrix4
    }
}

export function useIsTransforming(object: Object3D | RefObject<Object3D | null> | null = useThree(s => s.scene)) {
    const [isTransforming, setIsTransforming] = useState(false)
    useEvent(object, 'onTransformStart', () => setIsTransforming(true))
    useEvent(object, 'onTransformComplete', () => setIsTransforming(false))
    
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

export interface TransformControlsState {
    controlsPosition: TransformControlsPosition
    coordinateSystem: TransformCoordinateSystem
    transformType: TransformType
    islandTransform: boolean
}

export interface TransformToolProps {
    objects: ObservableList<Object3D>
    state: TransformControlsState
}

interface TransformToolImplProps extends TransformToolProps, Omit<TransformComponentProps, 'object'> {
}

export function TransformTool(props: TransformToolProps) {
    const propsImpl = useMemo<TransformToolImplProps>(() => ({
        ...props,
        transformers: new Map()
    }), [props])

    switch (props.state.controlsPosition) {
        case TransformControlsPosition.average:
            return <TransformTool_average {...propsImpl} />
        case TransformControlsPosition.each:
            return <TransformTool_each {...propsImpl} />
        case TransformControlsPosition.first:
            return <TransformTool_first {...propsImpl} />
        case TransformControlsPosition.last:
            return <TransformTool_last {...propsImpl} />
    }
}

const TransformTool_first = memo(({ objects, ...props }: TransformToolImplProps) => {
    const object = useObservableList(objects).at(0)
    if (!object)
        return null

    return <TransformComponent object={object} {...props} />
})

const TransformTool_last = memo(({ objects, ...props }: TransformToolImplProps) => {
    const object = useObservableList(objects).at(-1)
    if (!object)
        return null

    return <TransformComponent object={object} {...props} />
})

const TransformTool_each = memo(({ objects, ...props }: TransformToolImplProps) => {
    const objects_ = useObservableList(objects)

    return (
        <group name="transform-tools">
            {objects_.map(object => <TransformComponent key={object.uuid} object={object} {...props} />)}
        </group>
    )
})

const TransformTool_average = memo(({ objects, ...props }: TransformToolImplProps) => {
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
        if (!average || objects.length === 0)
            return

        const average_pos = new Vector3()
        const average_quat = new Quaternion(0, 0, 0, 0)
        const average_scale = new Vector3()
        
        for (const object of objects) {
            average_pos.add(object.getWorldPosition(new Vector3()))

            const objQuat = object.getWorldQuaternion(new Quaternion())
            average_quat.x += objQuat.x
            average_quat.y += objQuat.y
            average_quat.z += objQuat.z
            average_quat.w += objQuat.w

            average_scale.add(object.getWorldScale(new Vector3()))
        }

        average_quat.normalize()
        average_pos.divideScalar(objects.length)
        average_scale.divideScalar(objects.length)
                
        average.position.copy(average_pos)
        average.quaternion.copy(average_quat)
        average.scale.copy(average_scale)
    }, [objects])

    // useTransformListener('transform', updateAverage)
    useItemEffect(objects, updateAverage)
    useLayoutEffect(updateAverage)

    return (
        <>
            <object3D ref={average_ref} />
            {average_resolved && <TransformComponent object={average_resolved} {...props} />}
        </>
    )
})

export interface TransformControlsProps {
}

function computeIslands(objects: ObservableList<Object3D>, separators: Object3D[]): Object3D[] {
    const islands: Object3D[] = []
    
    for (const object of objects)
        if (!islands.some(island => isDescendantOf(object, island, separators)))
            islands.push(object)
    
    return islands
}

function useIslands(objects: ObservableList<Object3D>, separators: Object3D[] = []) {
    const islands = useMemo(() => new ObservableList<Object3D>(...computeIslands(objects, separators)), [])
    
    useItemEffect(objects, object => {
        if (islands.includes(object))
            return

        // if this object is not a descendant of any other island, it's an island
        if (islands.some(island => isDescendantOf(object, island, separators)))
            return

        islands.push(object)

        // remove islands that are no longer islands
        for (let i = 0; i < islands.length; i++) {
            const island = islands[i]!
            if (isDescendantOf(island, object, separators))
                islands.splice(i--, 1)
        }

        return () => {
            // objects eligible for island d/t item object removed
            const objectsNowIslands = objects.filter(child => isDescendantOf(child, object, separators))
            // remove objects that are children of another object in objectsNowIslands
            for (let i = 0; i < objectsNowIslands.length; i++) {
                const objectNowIsland = objectsNowIslands[i]
                if (objectsNowIslands.some(otherObjNowIsland => isDescendantOf(objectNowIsland, otherObjNowIsland, separators)))
                    objectsNowIslands.splice(i--, 1)
            }

            const index = islands.indexOf(object)
            if (index !== -1)
                islands.splice(index, 1, ...objectsNowIslands)
        }
    }, [separators])

    return islands
}

function useTransformableObjects(selectable: SelectableInfo, islandTransform: boolean) {
    const selection = selectable.selection
    const islands = useIslands(selection)

    return islandTransform ? islands : selection
}

// function useApplyTransform(objects: ObservableList<Object3D>, coordinateSystem: TransformCoordinateSystem) {
//     // only in local coordinate system (relative to parent)
//     const objects_onTransformStart = useRef(new Map<Object3D, Matrix4>())
//     const currentTransformDirectlyTransformedObjects = useRef(new Set<Object3D>())

//     const coordinateSystem_ref = useRef(coordinateSystem)
//     useEffect(() => {
//         coordinateSystem_ref.current = coordinateSystem
//     }, [coordinateSystem])

//     useItemEffect(objects, object => {
//         objects_onTransformStart.current.set(object, object.matrix.clone())

//         return () => {
//             objects_onTransformStart.current.delete(object)
//             currentTransformDirectlyTransformedObjects.current.delete(object)
//         }
//     })

//     useTransformListener('start', directlyTransformedObj => {
//         console.log(`transform started for ${directlyTransformedObj.name} (${directlyTransformedObj.uuid})`)
//         objects_onTransformStart.current.set(directlyTransformedObj, directlyTransformedObj.matrix.clone())
//         currentTransformDirectlyTransformedObjects.current.add(directlyTransformedObj)
//     }, [objects])

//     const applyTransform = useCallback((transform: Matrix4) => {
//         for (const object of objects) {
//             if (!currentTransformDirectlyTransformedObjects.current.has(object)) {
//                 console.log(`applying transform to ${object.name} (${object.uuid})`)
//                 const onTransformStart = objects_onTransformStart.current.get(object)
//                 if (!onTransformStart)
//                     throw new Error("indirectly transformed object's start transform not found")

//                 const deltaTransform = getDeltaTransform(object, coordinateSystem_ref.current, transform)
//                 const transformEnd = onTransformStart.clone().multiply(deltaTransform)
//                 setObjectTransform(object, transformEnd)
//             }
//         }
//     }, [objects])

//     useTransformListener('transform', (_, transform) => {
//         applyTransform(transform)
//     }, [objects, applyTransform])

//     // const isTransforming = useIsTransforming()
//     // useEffect(() => {
//     //     if (!isTransforming)
//     //         currentTransformDirectlyTransformedObjects.current.clear()
//     // }, [isTransforming])

//     useTransformListener('complete', (directlyTransformedObj, transform) => {
//         applyTransform(transform)
//         console.log(`transform complete for ${directlyTransformedObj.name} (${directlyTransformedObj.uuid})`)
//         currentTransformDirectlyTransformedObjects.current.delete(directlyTransformedObj)
//     }, [objects, applyTransform])
// }

export function TransformControls({ }: TransformControlsProps) {
    const [controlsPosition, setControlsPosition] = useState<TransformControlsPosition>(TransformControlsPosition.first)
    const [coordinateSystem, setCoordinateSystem] = useState<TransformCoordinateSystem>(TransformCoordinateSystem.local)
    const [transformType, setTransformType] = useState<TransformType>({
        translate: true,
        rotate: false,
        scale: false,
    })
    const [islandTransform, setIslandTransform] = useState<boolean>(true)

    const state = useMemo<TransformControlsState>(() => ({
        controlsPosition,
        coordinateSystem,
        transformType,
        islandTransform,
    }), [controlsPosition, coordinateSystem, transformType, islandTransform])

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

    const objects = useSelection({ observe: false })

    return (
        <>
            <TransformTool
                objects={objects}
                state={state}
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
                    onChange={value => setControlsPosition(value as TransformControlsPosition)}
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
    transformers: Map<SelectableInfo, ObjectTransformer>
    state: TransformControlsState
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

class ObjectTransformer {
    readonly directlyTransformed: Object3D[] = []
    readonly #startTransforms = new Map<Object3D, Matrix4>()
    coordinateSystem: TransformCoordinateSystem | undefined

    constructor(readonly transformed: ObservableList<Object3D>) { }

    #applyTransform(transform: Matrix4) {
        for (const object of this.transformed) {
            if (!this.directlyTransformed.includes(object)) {
                console.log(`applying transform to ${object.name} (${object.uuid})`)
                const onTransformStart = this.#startTransforms.get(object)
                if (!onTransformStart)
                    throw new Error("indirectly transformed object's start transform not found")

                const deltaTransform = getDeltaTransform(object, this.coordinateSystem!, transform)
                const transformEnd = onTransformStart.clone().multiply(deltaTransform)
                setObjectTransform(object, transformEnd)
            }
        }
    }

    start(directlyTransformedObj: Object3D, coordinateSystem: TransformCoordinateSystem) {
        this.directlyTransformed.push(directlyTransformedObj)
        this.coordinateSystem = coordinateSystem
        
        for (const obj of this.transformed) {
            dispatchEventBubbled(obj, { type: 'onTransformStart', bubbles: true })
            this.#startTransforms.set(obj, getCurrentTransform(obj, this.coordinateSystem))
        }
    }

    transform(transform: Matrix4) {
        this.#applyTransform(transform)
        for (const obj of this.transformed)
            dispatchEventBubbled(obj, { type: 'onTransform', bubbles: true, transform })
    }

    complete(transform: Matrix4) {
        this.#applyTransform(transform)
        for (const obj of this.transformed)
            dispatchEventBubbled(obj, { type: 'onTransformComplete', bubbles: true, transform })
    }
}

function TransformComponent({ object, state, transformers }: TransformComponentProps) {
    const selectControlsInfo = useSelectControlsInfo()
    const selectable = useGlobalSelectable(object)
    const { islandTransform, transformType } = state
    const transformedObjects = useTransformableObjects(selectable, islandTransform)
    const transformer = useMemo(() => {
        let transformer = transformers.get(selectable)
        if (!transformer)
            transformers.set(selectable, transformer = new ObjectTransformer(transformedObjects))
        return transformer
    }, [transformers, selectable])
    
    const startTransform = useRef<Matrix4 | null>(null)

    const onStart = useCallback(() => {
        if (!object)
            return
        
        selectControlsInfo.disabled = true
        const { coordinateSystem } = state
        startTransform.current = getCurrentTransform(object, coordinateSystem)

        transformer.start(object, coordinateSystem)
    }, [object, transformer, selectControlsInfo, state])

    const onComplete = useCallback(() => {
        if (!object)
            return
        
        if (!startTransform.current)
            return

        const { coordinateSystem } = state

        const endTransform = getCurrentTransform(object, coordinateSystem)
        const deltaTransform = endTransform.invert().multiply(startTransform.current)
        startTransform.current = null

        transformer.complete(deltaTransform)

        setTimeout(() => selectControlsInfo.disabled = false, 100)
    }, [object, transformer, selectControlsInfo, state])

    const onTransform = useCallback(() => {
        if (!object)
            return

        if (!startTransform.current)
            return

        const { coordinateSystem } = state

        const endTransform = getCurrentTransform(object, coordinateSystem)
        const deltaTransform = endTransform.clone().invert().multiply(startTransform.current)
        startTransform.current = endTransform.clone()

        transformer.transform(deltaTransform)
    }, [object, transformer, state])

    const space: TransformControlsImplProps['space'] = state.coordinateSystem === TransformCoordinateSystem.global ? 'world' : 'local'
    const scene = useThree(s => s.scene)

    const transformControlRef_translate = useRef<TransformControlsImpl2|null>(null)
    const transformControlRef_rotate = useRef<TransformControlsImpl2|null>(null)
    const transformControlRef_scale = useRef<TransformControlsImpl2|null>(null)

    // transform helpers would result in onPointerMissed otherwise
    for (const control of [transformControlRef_translate, transformControlRef_rotate, transformControlRef_scale])
        usePointerEventsIgnored(control)

    return (
        <Parented parent={scene}>
            {transformType.translate && object && <TransformControlsImpl
                ref={transformControlRef_translate}
                key='translate'
                object={object}
                mode='translate'
                space={space}
                onMouseDown={onStart}
                onMouseUp={onComplete}
                onChange={onTransform} />}
            {transformType.rotate && object && <TransformControlsImpl
                ref={transformControlRef_rotate}
                key='rotate'
                object={object}
                mode='rotate'
                space={space}
                onMouseDown={onStart}
                onMouseUp={onComplete}
                onChange={onTransform} />}
            {transformType.scale && object && <TransformControlsImpl
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
