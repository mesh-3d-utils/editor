import { TransformControls, TransformControlsProps } from '@react-three/drei'
import { useSelection } from './select.js'
import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { createContext, DependencyList, memo, PropsWithChildren, RefObject, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MultiSelect, Select } from '../ui/select.js'
import { Toolbar } from '../ui/toolbar.js'
import { Parented } from '../utils/parented.js'
import { useItemEffect } from '../utils/observable-list.js'
import { useThree } from '@react-three/fiber'

export class TransformInfo {
    readonly listeners = {
        start: [] as ((object: Object3D) => void)[],
        complete: [] as ((transform: Matrix4, object: Object3D) => void)[],
        transform: [] as ((transform: Matrix4, object: Object3D) => void)[]
    }
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

export function useTransformListener(callback: (transform: Matrix4) => void, deps?: DependencyList) {
    const transformInfo = useTransformInfo()
    useEffect(() => {
        transformInfo.listeners.transform.push(callback)
        return () => {
            const index = transformInfo.listeners.transform.indexOf(callback)
            if (index !== -1)
                transformInfo.listeners.transform.splice(index, 1)
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

export function useOnTransform(callback: (transform: Matrix4, obj: Object3D) => void, deps?: DependencyList) {
    const transformInfo = useTransformInfo()
    useEffect(() => {
        transformInfo.listeners.transform.push(callback)
        return () => {
            const index = transformInfo.listeners.transform.indexOf(callback)
            if (index !== -1)
                transformInfo.listeners.transform.splice(index, 1)
        }
    }, [transformInfo, callback, ...(deps ?? [])])
}

export enum TransformCoordinateSystem {
    local = 'local',
    global = 'global',
}

export enum TransformOrigin {
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
    transformOrigin?: TransformOrigin
    coordinateSystem?: TransformCoordinateSystem
    transformType?: Readonly<TransformType>
}

export function TransformTool({
        coordinateSystem = TransformCoordinateSystem.local,
        transformOrigin = TransformOrigin.average,
        transformType = {
            translate: true,
            rotate: false,
            scale: false,
        },
    }: TransformToolProps) {
    const selection = useSelection()

    if (selection.length === 0) {
        return null
    }

    const transformComponentProps: Omit<TransformComponentProps, 'object'> = {
        coordinateSystem,
        transformType,
    }

    switch(transformOrigin) {
        case TransformOrigin.average:
            return <AverageTransformTool {...transformComponentProps} />
        case TransformOrigin.each:
            return selection.map(object => <TransformComponent key={object.uuid} object={object} {...transformComponentProps} />)
        case TransformOrigin.first:
            return <TransformComponent object={selection[0]} {...transformComponentProps} />
        case TransformOrigin.last:
            return <TransformComponent object={selection[selection.length - 1]} {...transformComponentProps} />
    }
}

const AverageTransformTool = memo((props: Omit<TransformComponentProps, 'object'>) => {
    const selection = useSelection()

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
    }, [average_ref])

    const updateAverage = useCallback(() => {
        const average = average_ref.current
        if (!average || selection.length === 0)
            return

        const average_pos = new Vector3()
        selection.forEach(object => average_pos.add(object.getWorldPosition(new Vector3())))
        average_pos.divideScalar(selection.length)
        
        const average_quat = new Quaternion(0, 0, 0, 0)
        selection.forEach(object => {
            const objQuat = object.getWorldQuaternion(new Quaternion())
            average_quat.x += objQuat.x
            average_quat.y += objQuat.y
            average_quat.z += objQuat.z
            average_quat.w += objQuat.w
        })
        average_quat.normalize()
        
        const average_scale = new Vector3()
        selection.forEach(object => average_scale.add(object.getWorldScale(new Vector3())))
        average_scale.divideScalar(selection.length)
        
        average.position.copy(average_pos)
        average.quaternion.copy(average_quat)
        average.scale.copy(average_scale)
    }, [selection])

    useTransformListener(updateAverage)
    useItemEffect(selection, updateAverage)
    useLayoutEffect(updateAverage)

    return (
        <group ref={average_ref}>
            {average_resolved && <TransformComponent object={average_resolved} {...props} />}
        </group>
    )
})

export interface EditorTransformControlsProps {
}

export function EditorTransformControls({ }: EditorTransformControlsProps) {
    const [transformOrigin, setTransformOrigin] = useState<TransformOrigin>(TransformOrigin.average)
    const [coordinateSystem, setCoordinateSystem] = useState<TransformCoordinateSystem>(TransformCoordinateSystem.local)
    const [transformType, setTransformType] = useState<TransformType>({
        translate: true,
        rotate: false,
        scale: false,
    })

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

    return (
        <>
            <TransformTool
                transformOrigin={transformOrigin}
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
                            value: TransformOrigin.average,
                            text: 'Average',
                            icon: <>A</>,
                        },
                        {
                            value: TransformOrigin.each,
                            text: 'Each',
                            icon: <>E</>,
                        },
                        {
                            value: TransformOrigin.first,
                            text: 'First',
                            icon: <>F</>,
                        },
                        {
                            value: TransformOrigin.last,
                            text: 'Last',
                            icon: <>L</>,
                        },
                    ]}
                    value={transformOrigin}
                    onChange={value => setTransformOrigin(value as TransformOrigin)}
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
            </Toolbar>
        </>
    )
}

interface TransformComponentProps {
    object?: Object3D | RefObject<Object3D | null> | null

    coordinateSystem: TransformCoordinateSystem
    transformType: Readonly<TransformType>
}

function TransformComponent({ object, coordinateSystem, transformType }: TransformComponentProps) {
    const transformInfo = useTransformInfo()

    // objects are ordered: "object" > transformedObj > TransformControls
    const transformedObj_ref = useRef<Object3D>(null!)
    const [transformedObj_resolved, transformedObj_setResolved] = useState<Object3D | null>(transformedObj_ref.current)
    useEffect(() => {
        const p = transformedObj_ref.current
        if (p)
            transformedObj_setResolved(p)
        else {
            // Wait until the ref is assigned
            const id = requestAnimationFrame(() => {
                if (transformedObj_ref.current) transformedObj_setResolved(transformedObj_ref.current)
            })
            return () => cancelAnimationFrame(id)
        }
    }, [transformedObj_ref])

    const startTransform = useRef<Matrix4 | null>(null)

    const onStart = useCallback(() => {
        const obj = object ?
            'current' in object ?
                object.current :
                object :
            null
        
        if (!obj)
            throw new Error('object is undefined')
        
        startTransform.current = obj[
            coordinateSystem === TransformCoordinateSystem.local ? 'matrix' :
            coordinateSystem === TransformCoordinateSystem.global ? 'matrixWorld' :
                    'matrixWorld'].clone()
        
        transformInfo.listeners.start.forEach(listener => listener(obj))
    }, [object, transformInfo])

    const onComplete = useCallback(() => {
        const obj = object ?
            'current' in object ?
                object.current :
                object :
            null
        
        if (!obj)
            throw new Error('object is undefined')
        if (!startTransform.current)
            throw new Error('startTransform is undefined')

        const endTransform = obj[
            coordinateSystem === TransformCoordinateSystem.local ? 'matrix' :
            coordinateSystem === TransformCoordinateSystem.global ? 'matrixWorld' :
            'matrixWorld'
        ].clone()
        
        const deltaTransform = endTransform.invert().multiply(startTransform.current)
        startTransform.current = null

        transformInfo.listeners.complete.forEach(listener => listener(deltaTransform, obj))
    }, [object, transformInfo])

    const onTransform = useCallback(() => {
        const obj = object ?
            'current' in object ?
                object.current :
                object :
            null
        
        if (!obj)
            throw new Error('object is undefined')
        
        const transformObj = transformedObj_resolved
        if (!transformObj)
            throw new Error('transformObj_resolved is undefined')

        // delta transform is the local transform of transformedObj
        // delta transform is applied to the transform listeners
        // reposition transformedObj to local identity
        // though its parent (object) is listening to the transform events
        // and applies the delta transform
        // so it will appear to transform following user intent
        // though this permits other objects to respond to the transform listeners
        // though they weren't dragged/rotated/scale directly

        // transformedObj is identity transform in local coordinates
        // any difference from this is the delta transform
        let deltaTransform: Matrix4
        switch(coordinateSystem) {
            case TransformCoordinateSystem.local:
                deltaTransform = transformObj.matrix
                break

            case TransformCoordinateSystem.global:
                // extract only 3x3 rotation/scale part of matrixWorld to transform the deltaTransform into world coordinates
                deltaTransform = transformObj.matrix.clone().multiply(obj.matrixWorld.clone().setPosition(new Vector3()))
                break
        }

        const d_position = new Vector3()
        const d_quaternion = new Quaternion()
        const d_scale = new Vector3()
        deltaTransform.decompose(d_position, d_quaternion, d_scale)
        const d_rotation = new Euler().setFromQuaternion(d_quaternion)
        const precision = 3
        console.log(`onTransform ` +
            `position: ${d_position.x.toFixed(precision)}, ${d_position.y.toFixed(precision)}, ${d_position.z.toFixed(precision)}, ` +
            `rotation: ${d_rotation.x.toFixed(precision)}, ${d_rotation.y.toFixed(precision)}, ${d_rotation.z.toFixed(precision)}, ` +
            `scale: ${d_scale.x.toFixed(precision)}, ${d_scale.y.toFixed(precision)}, ${d_scale.z.toFixed(precision)}`)
        
        if (transformObj.position.x > 0.5) {
            transformObj.position.set(0, 0, 0)
            transformObj.rotation.set(0, 0, 0)
            transformObj.scale.set(1, 1, 1)
            transformObj.updateMatrix()
        }
        
        for (const listener of transformInfo.listeners.transform)
            listener(deltaTransform, obj)
    }, [transformInfo, object, transformedObj_resolved])

    // in 'each' transform mode,
    useOnTransform(deltaTransform => {
        const obj = object ?
            'current' in object ?
                object.current :
                object :
            null
        
        if (!obj)
            throw new Error('object is undefined')
        
        switch (coordinateSystem) {
            case TransformCoordinateSystem.local:
                obj.applyMatrix4(deltaTransform)
                break
            case TransformCoordinateSystem.global:
                //TODO: convert deltaTransform to local coordinates
                // extract only 3x3 rotation/scale part of matrixWorld
                const localTransform = deltaTransform.clone().premultiply(
                    obj.matrixWorld.clone()
                        .setPosition(new Vector3())
                        .invert()
                )

                obj.applyMatrix4(localTransform)
                break
        }
    }, [object, coordinateSystem])

    const space: TransformControlsProps['space'] = coordinateSystem === TransformCoordinateSystem.global ? 'world' : 'local'
    const scene = useThree(s => s.scene)

    return (
        <>
            <Parented parent={object}>
                <object3D ref={transformedObj_ref} name='transformedObj' />
            </Parented>
            <Parented parent={scene}>
                {transformType.translate && transformedObj_resolved && <TransformControls
                    object={transformedObj_resolved}
                    mode='translate'
                    space={space}
                    onMouseDown={onStart}
                    onMouseUp={onComplete}
                    onChange={onTransform} />}
                {transformType.rotate && transformedObj_resolved && <TransformControls
                    object={transformedObj_resolved}
                    mode='rotate'
                    space={space}
                    onMouseDown={onStart}
                    onMouseUp={onComplete}
                    onChange={onTransform} />}
                {transformType.scale && transformedObj_resolved && <TransformControls
                    object={transformedObj_resolved}
                    mode='scale'
                    space={space}
                    onMouseDown={onStart}
                    onMouseUp={onComplete}
                    onChange={onTransform} />}
            </Parented>
        </>
    )
}
