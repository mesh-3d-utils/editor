import { Geometry, GeometryMeshObject3DHelper } from '@mesh-3d-utils/core';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useIsSelected, useSelection } from './select.js';
import * as THREE from 'three';
import { Toolbar } from '../ui/toolbar.js';
import { MultiSelect } from '../ui/select.js';
import { Parented } from '../utils/parented.js';
import { Instance, Instances } from '@react-three/drei';

export interface GeometryEditMode {
    vertex: boolean
    edge: boolean
    face: boolean
}

export interface GeometryEditorConfig {
    colors: {
        default: THREE.Color
        selected: THREE.Color
    }
}

export interface GeometryEditToolProps {
    mode: GeometryEditMode
    config: GeometryEditorConfig
}

export function GeometryEditTool({ mode, config }: GeometryEditToolProps) {
    const selection = useSelection()

    const geometryEditComponents = selection
        .filter(obj => obj instanceof THREE.Mesh)
        .map(object => (
            <GeometryEditComponent key={object.uuid} mode={mode} object={object} config={config} />
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
    const [mode, setMode] = useState<GeometryEditMode>({
        vertex: true,
        edge: false,
        face: false,
    })

    const setModeFromValue = useCallback((value: string[]) => {
        setMode({
            vertex: value.includes("vertex"),
            edge: value.includes("edge"),
            face: value.includes("face"),
        })
    }, [setMode])

    const valuesForMode = useMemo(() => {
        const values: string[] = []
        if (mode.vertex)
            values.push("vertex")
        if (mode.edge)
            values.push("edge")
        if (mode.face)
            values.push("face")
        return values
    }, [mode])

    return (
        <>
            <GeometryEditTool mode={mode} config={config} />
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
        </>
    )
}

export interface GeometryEditComponentProps {
    mode: GeometryEditMode
    object: ConstructorParameters<typeof GeometryMeshObject3DHelper>[0]
    config: GeometryEditorConfig
}

export function GeometryEditComponent({ mode, object, config }: GeometryEditComponentProps) {
    const helper = useMemo(() => new GeometryMeshObject3DHelper(object), [object])

    return (
        <Parented parent={helper.obj}>
            {mode.vertex && <GeometryEditVertices helper={helper} config={config} />}
            {mode.edge && <GeometryEditEdges helper={helper} config={config} />}
            {mode.face && <GeometryEditFaces helper={helper} config={config} />}
        </Parented>
    )
}

interface GeometryEditFeaturesProps {
    helper: GeometryMeshObject3DHelper

    /**
     * geometry edited
     * 
     * geometry for helper.meshRoot
     */
    geometry: Geometry
    config: GeometryEditorConfig
}

interface GeometryEditFeatureProps extends GeometryEditFeaturesProps {
    /** specific feature to edit */
    index: number
}

function GeometryEditVertices({ geometry, helper, config }: GeometryEditFeaturesProps) {
    // TODO: transition to using THREE.InstancedMesh directly
    // though for relatively small meshes prototyping could work with Instances

    //TODO: show vertices as screen-space sized
    // custom vertex shader could be required for this

    return (
        <Instances>
            <sphereGeometry args={[0.1]} />
            <meshStandardMaterial />
            {Array.from({ length: geometry.mesh.vertices.x.length}, (_, i) => (
                <GeometryEditVertex key={i} helper={helper} config={config} index={i} />
            ))}
        </Instances>
    )
}

const GeometryEditVertex = memo(({ helper, index, config }: GeometryEditFeatureProps) => {
    const ref = useRef<THREE.Mesh | undefined>(undefined)
    const position_x = helper.meshRoot.mesh.vertices.x[index]!
    const position_y = helper.meshRoot.mesh.vertices.y[index]!
    const position_z = helper.meshRoot.mesh.vertices.z[index]!
    const isSelected = useIsSelected(ref.current)

    return (
        <Instance
            ref={ref}
            color={isSelected ? config.colors.selected : config.colors.default}
            position={[position_x, position_y, position_z]} />
    )
})

function GeometryEditEdges({ /* helper, editor */ }: GeometryEditFeaturesProps) {
    //TODO: display wireframe of edges
    // before implementing this, the mesh class (in mesh-3d-utils, not threejs mesh)
    // should be updated to include edges

    return (
        <group>
            {/* {Array.from({ length: helper.meshRoot.mesh.edges.length }, (_, i) => (
                <GeometryEditEdge key={i} helper={helper} index={i} />
            ))} */}
        </group>
    )
}

function GeometryEditFaces({ helper, config }: GeometryEditFeaturesProps) {
    //TODO: implement instances similarly
    /**
     * When a face is not selected, we just render the instance for the center of the face,
     * and it's rotated to be facing outward, that is, facing toward the direction of the normal of the face.
     * That code is already currently implemented. Though, when the face is selected,
     * we keep that instance that renders a normal, we keep that like usual, though we also return a new child,
     * a regular react three object, that is a mesh showing only the face that it represents.
     * This lets that selected face itself be represented by a threejs object3D.
     * When the face is unselected, the helper object is not returned from <GeometryEditFace>
     */

    return (
        <group>
            {Array.from({ length: helper.meshRoot.mesh.faces.indicesOffset1.length }, (_, i) => (
                <GeometryEditFace key={i} helper={helper} config={config} index={i} />
            ))}
        </group>
    )
}

const GeometryEditFace = memo(({ helper, index, config }: GeometryEditFeatureProps) => {
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
            <meshStandardMaterial color={isSelected ? config.colors.selected : config.colors.default} />
        </mesh>
    )
})
