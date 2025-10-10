import { compileGeometryMapsFrom, Geometry, GeometryMeshObject3DHelper, MeshGeometry } from '@mesh-3d-utils/core';
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
    config?: GeometryEditorConfig
}

export function GeometryEditControls({
        config = {
            colors: {
                default: new THREE.Color("#000000"),
                selected: new THREE.Color("#000000"),
            },
        },
    }: GeometryEditControlsProps) {
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
    const geometry = useMemo<GeometryEditDisplay>(() => ({
        map: compileGeometryMapsFrom(helper.geometry, helper.meshRoot),
        edit: helper.meshRoot,
        display: helper.geometry,
    }), [helper])

    return (
        <Parented parent={helper.obj}>
            {mode.vertex && <GeometryEditVertices helper={helper} geometry={geometry} config={config} />}
            {mode.edge && <GeometryEditEdges helper={helper} geometry={geometry} config={config} />}
            {mode.face && <GeometryEditFaces helper={helper} geometry={geometry} config={config} />}
        </Parented>
    )
}

export type GeometryEditDisplay = Readonly<{
    edit: MeshGeometry
    display: Geometry
    /** edit -> display */
    map: Geometry['map']
}>

interface GeometryEditFeaturesProps {
    helper: GeometryMeshObject3DHelper
    geometry: GeometryEditDisplay
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
            <meshBasicMaterial vertexColors />
            {Array.from({ length: geometry.edit.map.vertex.lengths.self }, (_, i) => (
                <GeometryEditVertex key={i} helper={helper} geometry={geometry} config={config} index={i} />
            ))}
        </Instances>
    )
}

const GeometryEditVertex = memo(({ geometry, index, config }: GeometryEditFeatureProps) => {
    const ref = useRef<THREE.Mesh | undefined>(undefined)
    
    const indices_display = geometry.map.vertex.fromBase(index).indices
    if (indices_display.length === 0)
        return // vertex removed by geometry function
    else if (indices_display.length > 1)
        throw new Error("expected single index")

    const index_display = indices_display[0]!

    const position = geometry.display.mesh.vertex(index_display)
    const isSelected = useIsSelected(ref.current)

    return (
        <Instance
            ref={ref}
            color={isSelected ? config.colors.selected : config.colors.default}
            position={position} />
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

function GeometryEditFaces({ helper, geometry, config }: GeometryEditFeaturesProps) {
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
        <Instances>
            <boxGeometry args={[0.1, 0.1, 0.01]} />
            <meshBasicMaterial vertexColors />
            {Array.from({ length: geometry.edit.map.face.lengths.self }, (_, i) => (
                <GeometryEditFace key={i} helper={helper} geometry={geometry} config={config} index={i} />
            ))}
        </Instances>
    )
}

const GeometryEditFace = memo(({ geometry, index, config }: GeometryEditFeatureProps) => {
    // handle in center of face for transforming
    const ref = useRef<THREE.Mesh|undefined>(undefined)
    
    const face = useMemo(() => {
        const info_base = geometry.edit.mesh.face(index)
        const faces_display = geometry.map.face.fromBase(index).indices
        const info_display = geometry.display.mesh.faceInfoMean(faces_display)
        
        const center = new THREE.Vector3(...info_display.center)
        const normal = new THREE.Vector3(...info_display.normal)
        const rotation = new THREE.Euler().setFromQuaternion(
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                normal
            )
        )

        return {
            ...info_base,
            center,
            rotation,
        }
    }, [geometry, index])
    
    const isSelected = useIsSelected(ref.current)

    return (
        <mesh
            ref={ref}
            position={face.center}
            rotation={face.rotation}>
            <Instance
                scale={isSelected ? 2 : 1}
                color={isSelected ? config.colors.selected : config.colors.default}
            />
        </mesh>
    )
})
