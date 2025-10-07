import { TransformControls, TransformControlsProps } from '@react-three/drei'
import { useSelection } from './select.js'
import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MultiSelect, Select } from '../ui/select.js'
import { Toolbar } from '../ui/toolbar.js'
import { Parented } from '../utils/parented.js'

export class TransformInfo {
    readonly listeners = {
        transform: [] as ((transform: Matrix4) => void)[]
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
            const average = useRef<Object3D>(null!)
            
            useEffect(() => {
                function computeAverage() {
                    const average_pos = new Vector3()
                    selection.forEach(object => average_pos.add(object.getWorldPosition(new Vector3())))
                    average_pos.divideScalar(selection.length)
                    
                    //TODO: is this correct way to average rotations?
                    const average_euler = new Euler()
                    selection.forEach(object => {
                        const object_rot = new Euler().setFromQuaternion(object.getWorldQuaternion(new Quaternion()))
                        average_euler.x += object_rot.x
                        average_euler.y += object_rot.y
                        average_euler.z += object_rot.z
                    })
                    average_euler.x /= selection.length
                    average_euler.y /= selection.length
                    average_euler.z /= selection.length
                    
                    const average_scale = new Vector3()
                    selection.forEach(object => average_scale.add(object.getWorldScale(new Vector3())))
                    average_scale.divideScalar(selection.length)
                    
                    average.current.position.copy(average_pos)
                    average.current.setRotationFromEuler(average_euler)
                    average.current.scale.copy(average_scale)
                }

                computeAverage()
            }, [selection])

            return (
                <group ref={average}>
                    <TransformComponent object={average.current} {...transformComponentProps} />
                </group>
            )
        
        case TransformOrigin.each:
            return selection.map(object => <TransformComponent key={object.uuid} object={object} {...transformComponentProps} />)
        case TransformOrigin.first:
            return <TransformComponent object={selection[0]} {...transformComponentProps} />
        case TransformOrigin.last:
            return <TransformComponent object={selection[selection.length - 1]} {...transformComponentProps} />
    }
}

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
    object?: Object3D | null

    coordinateSystem: TransformCoordinateSystem
    transformType: Readonly<TransformType>
}

function TransformComponent({ object, coordinateSystem, transformType }: TransformComponentProps) {
    const transformInfo = useTransformInfo()

    // objects are ordered: "object" > transformedObj > TransformControls
    const transformedObj = useRef<Object3D>(null!)

    const onTransform = useCallback(() => {
        if (!object)
            throw new Error('object is undefined')

        // discern delta transform from previous onTransform() call
        // apply inverse delta transform to the transformedObj
        // apply to the transform listeners
        // transformedObj is child of an object responding to the transform listeners
        // so it will appear to transform following user intent
        // though this permits other objects to respond to the transform listeners
        // though they weren't dragged/rotated/scale directly

        // transformedObj is identity transform in local coordinates
        // any difference from this is the delta transform
        const deltaTransform = transformedObj.current.matrix

        transformedObj.current.applyMatrix4(deltaTransform.clone().invert())
        
        switch (coordinateSystem) {
            case TransformCoordinateSystem.local:
                break
            
            case TransformCoordinateSystem.global:
                // apply inverse of object's world transform to deltaTransform
                const localToWorld = object.matrixWorld.clone().invert()
                // remove world translation from localToWorld, keep orientation and scale
                localToWorld.setPosition(new Vector3())
                deltaTransform.multiply(localToWorld)
                break
        }
        
        for (const listener of transformInfo.listeners.transform)
            listener(deltaTransform)
    }, [transformInfo, object])

    const space: TransformControlsProps['space'] = coordinateSystem === TransformCoordinateSystem.global ? 'world' : 'local'

    return (
        <Parented parent={object}>
            <object3D ref={transformedObj}>
                {transformType.translate && <TransformControls
                    object={transformedObj}
                    mode='translate'
                    space={space}
                    onChange={onTransform} />}
                {transformType.rotate && <TransformControls
                    object={transformedObj}
                    mode='rotate'
                    space={space}
                    onChange={onTransform} />}
                {transformType.scale && <TransformControls
                    object={transformedObj}
                    mode='scale'
                    space={space}
                    onChange={onTransform} />}
            </object3D>
        </Parented>
    )
}
