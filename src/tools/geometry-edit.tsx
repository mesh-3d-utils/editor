import { GeometryMeshObject3DHelper } from '@mesh-3d-utils/core';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsSelected, useSelection } from './select.js';
import * as THREE from 'three';
import { Toolbar } from '../ui/toolbar.js';
import { MultiSelect } from '../ui/select.js';
import { Parented } from '../utils/parented.js';

export enum GeometryEditMode {
    vertex = 0x1,
    edge = 0x2,
    face = 0x4,
}

export interface GeometryEditToolProps {
    mode: GeometryEditMode
}

export function GeometryEditTool({ mode }: GeometryEditToolProps) {
    const selection = useSelection()

    const geometryEditComponents = selection
        .filter(obj => obj instanceof THREE.Mesh)
        .map(object => (
            <GeometryEditComponent key={object.uuid} mode={mode} object={object} />
        ))

    return (
        <>
            {geometryEditComponents}
        </>
    )
}

export interface GeometryEditControlsProps {
}

export function GeometryEditControls({ }: GeometryEditControlsProps) {
    const [mode, setMode] = useState<GeometryEditMode>(GeometryEditMode.vertex)

    const setModeFromValue = useCallback((value: string[]) => {
        setMode(
            (value.includes("vertex") ? GeometryEditMode.vertex : 0) |
            (value.includes("edge") ? GeometryEditMode.edge : 0) |
            (value.includes("face") ? GeometryEditMode.face : 0)
        )
    }, [setMode])

    const valuesForMode = useMemo(() => {
        const values: string[] = []
        if (mode & GeometryEditMode.vertex)
            values.push("vertex")
        if (mode & GeometryEditMode.edge)
            values.push("edge")
        if (mode & GeometryEditMode.face)
            values.push("face")
        return values
    }, [mode])

    return (
        <Toolbar>
            <MultiSelect
                items={[
                    { value: "vertex", text: "Vertex", icon: "V" },
                    { value: "edge", text: "Edge", icon: "E" },
                    { value: "face", text: "Face", icon: "F" },
                ]}
                value={valuesForMode}
                onChange={setModeFromValue}
            />
        </Toolbar>
    )
}

export interface GeometryEditComponentProps {
    mode: GeometryEditMode
    object: ConstructorParameters<typeof GeometryMeshObject3DHelper>[0]
}

export function GeometryEditComponent({ mode, object }: GeometryEditComponentProps) {
    const helper = useMemo(() => new GeometryMeshObject3DHelper(object), [object])

    return (
        <Parented parent={helper.obj}>
            {mode & GeometryEditMode.vertex && <GeometryEditVertices helper={helper} />}
            {mode & GeometryEditMode.edge && <GeometryEditEdges helper={helper} />}
            {mode & GeometryEditMode.face && <GeometryEditFaces helper={helper} />}
        </Parented>
    )
}

interface GeometryEditFeaturesProps {
    helper: GeometryMeshObject3DHelper
}

// function useGeometry(helper: GeometryMeshObject3DHelper) {
//     const [_, update] = useState({})

//     useEffect(() => {
//         helper
//     }, [helper])
// }

interface GeometryEditFeatureProps extends GeometryEditFeaturesProps {
    /** specific feature to edit */
    index: number
}

function GeometryEditVertices({ helper }: GeometryEditFeaturesProps) {
    return (
        <group>
            {Array.from({ length: helper.meshRoot.mesh.vertices.x.length }, (_, i) => (
                <GeometryEditVertex key={i} helper={helper} index={i} />
            ))}
        </group>
    )
}

const GeometryEditVertex = memo(({ helper, index }: GeometryEditFeatureProps) => {
    const ref = useRef<THREE.Mesh|undefined>(undefined)
    const position_x = helper.meshRoot.mesh.vertices.x[index]!
    const position_y = helper.meshRoot.mesh.vertices.y[index]!
    const position_z = helper.meshRoot.mesh.vertices.z[index]!
    const isSelected = useIsSelected(ref.current)

    return (
        <mesh ref={ref} position={[position_x, position_y, position_z]}>
            <sphereGeometry args={[0.1]} />
            <meshStandardMaterial color={isSelected ? "blue" : "black"} />
        </mesh>
    )
})

function GeometryEditEdges({ }: GeometryEditFeaturesProps) {
    //TODO: display wireframe of edges

    return (
        <group>
            {/* {Array.from({ length: helper.meshRoot.mesh.edges.length }, (_, i) => (
                <GeometryEditEdge key={i} helper={helper} index={i} />
            ))} */}
        </group>
    )
}

function GeometryEditFaces({ helper }: GeometryEditFeaturesProps) {
    return (
        <group>
            {Array.from({ length: helper.meshRoot.mesh.faces.indicesOffset1.length }, (_, i) => (
                <GeometryEditFace key={i} helper={helper} index={i} />
            ))}
        </group>
    )
}

const GeometryEditFace = memo(({ helper, index }: GeometryEditFeatureProps) => {
    // handle in center of face for transforming
    const ref = useRef<THREE.Mesh|undefined>(undefined)
    
    const face = useMemo(() => {
        const info = helper.meshRoot.mesh.face(index)
        const vertices = helper.meshRoot.mesh.vertices

        // face is assumed planar, so we can just use the first three vertices

        const v0 = new THREE.Vector3(
            vertices.x[info.vertices[0]!]!,
            vertices.y[info.vertices[0]!]!,
            vertices.z[info.vertices[0]!]!,
        )

        const v1 = new THREE.Vector3(
            vertices.x[info.vertices[1]!]!,
            vertices.y[info.vertices[1]!]!,
            vertices.z[info.vertices[1]!]!,
        )

        const v2 = new THREE.Vector3(
            vertices.x[info.vertices[2]!]!,
            vertices.y[info.vertices[2]!]!,
            vertices.z[info.vertices[2]!]!,
        )

        const v01 = v1.clone().sub(v0)
        const v02 = v2.clone().sub(v0)

        const normal = new THREE.Vector3().crossVectors(v01, v02).normalize()
        const rotation = new THREE.Euler().setFromQuaternion(
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                normal
            )
        )

        const center = new THREE.Vector3()
        for (let i = 0; i < info.vertices.length; i++) {
            const vertex = info.vertices[i]!
            center.x += vertices.x[vertex]!
            center.y += vertices.y[vertex]!
            center.z += vertices.z[vertex]!
        }

        center.divideScalar(info.vertices.length)

        return {
            ...info,
            center,
            normal,
            rotation,
        }
    }, [helper, index])
    
    const isSelected = useIsSelected(ref.current)

    return (
        <mesh ref={ref} position={face.center} rotation={face.rotation}>
            <boxGeometry args={[0.1, 0.1, 0.01]} />
            <meshStandardMaterial color={isSelected ? "blue" : "black"} />
        </mesh>
    )
})
