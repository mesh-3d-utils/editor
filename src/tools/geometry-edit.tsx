import { compileGeometryMapsFrom, Geometry, GeometryMeshObject3DHelper, MeshGeometry } from '@mesh-3d-utils/core';
import { DependencyList, EffectCallback, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Selectable, useIsSelected, useSelection } from './select.js';
import * as THREE from 'three';
import { Toolbar } from '../ui/toolbar.js';
import { MultiSelect } from '../ui/select.js';
import { Parented } from '../utils/parented.js';
import { Instance, Instances } from '@react-three/drei';
import { useEvent } from '../utils/object3D.js';

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
    
    const geometry = useMemo<GeometryEditInfo>(() => ({
        geometry: {
            map: compileGeometryMapsFrom(helper.geometry, helper.meshRoot),
            edit: helper.meshRoot,
            display: helper.geometry,
        },
        helper,
        config,
    }), [helper])

    return (
        <Parented parent={object}>
            <Selectable isolateSelections>
                {mode.vertex && <GeometryEditVertices info={geometry} />}
                {mode.edge && <GeometryEditEdges info={geometry} />}
                {mode.face && <GeometryEditFaces info={geometry} />}
            </Selectable>
        </Parented>
    )
}

export interface GeometryEditDisplay {
    edit: MeshGeometry
    display: Geometry
    /** edit -> display */
    map: Geometry['map']
}

export interface GeometryEditInfo {
    geometry: GeometryEditDisplay
    helper: GeometryMeshObject3DHelper
    config: GeometryEditorConfig
}

export function useUpdateWithGeometry(info: GeometryEditInfo, callback: EffectCallback, deps: DependencyList = []) {
    useEvent(info.helper.obj, 'geometryUpdate', useCallback(callback, deps))
}

interface GeometryEditFeaturesProps {
    info: GeometryEditInfo
}

interface GeometryEditFeatureProps extends GeometryEditFeaturesProps {
    /** specific feature to edit */
    index: number
}

function GeometryEditVertices({ info }: GeometryEditFeaturesProps) {
    // TODO: transition to using THREE.InstancedMesh directly
    // though for relatively small meshes prototyping could work with Instances

    //TODO: show vertices as screen-space sized
    // custom vertex shader could be required for this

    return (
        <Instances>
            <sphereGeometry args={[0.1]} />
            <meshBasicMaterial vertexColors />
            {Array.from({ length: info.geometry.edit.map.vertex.lengths.self }, (_, i) => (
                <GeometryEditVertex key={i} index={i} info={info} />
            ))}
        </Instances>
    )
}

const GeometryEditVertex = memo(({ info, index }: GeometryEditFeatureProps) => {
    const ref = useRef<THREE.Mesh | undefined>(undefined)
    
    const indices_display = info.geometry.map.vertex.fromBase(index).indices
    if (indices_display.length === 0)
        return // vertex removed by geometry function
    else if (indices_display.length > 1)
        throw new Error("expected single index")

    const index_display = indices_display[0]!
    const isSelected = useIsSelected(ref.current)
    
    const calculatePosition = useCallback(() => {
        const position = info.geometry.display.mesh.vertex(index_display)
        ref.current?.position.set(...position)
        return position
    }, [info.geometry.display, index_display])

    const position = calculatePosition()
    useUpdateWithGeometry(info, () => void calculatePosition(), [])

    // instance object3D used so that raycasting and select tool interact with it

    return (
        <Instance
            ref={ref}
            color={isSelected ? info.config.colors.selected : info.config.colors.default}
            position={position} />
    )
})

function GeometryEditEdges({ }: GeometryEditFeaturesProps) {
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

function GeometryEditFaces({ info }: GeometryEditFeaturesProps) {
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
        <group name="geometry-edit-faces">
            {Array.from({ length: info.geometry.edit.map.face.lengths.self }, (_, i) => (
                <GeometryEditFace key={i} index={i} info={info} />
            ))}
        </group>
    )
}

const GeometryEditFace = memo(({ info, index }: GeometryEditFeatureProps) => {
    // handle in center of face for transforming
    const ref = useRef<THREE.Mesh|undefined>(undefined)
    const bufferGeometry = useMemo(() => {
        const bufferGeometry = new THREE.BufferGeometry()
        // positions are shared with display mesh
        bufferGeometry.setAttribute('position', info.helper.obj.geometry.attributes.position)
        return bufferGeometry
    }, [])

    const face = useMemo(() => {
        const info_base = info.geometry.edit.mesh.face(index)
        const faces_display = info.geometry.map.face.fromBase(index)
        const info_display = info.geometry.display.mesh.faceInfoMean(faces_display.indices)
        
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
            faces_display,
        }
    }, [info.geometry, index])
    
    type FaceInfo = typeof face
    const updateIndices = useCallback((face: FaceInfo) => {
        const display_indices = face.faces_display.indices
        
        // Ensure index buffer exists and is large enough
        const indexAttr = bufferGeometry.getIndex() as THREE.BufferAttribute | null;
        const requiredIndexLen = display_indices.length;
    
        let indexArray: Uint32Array;
        if (!indexAttr || indexAttr.array.length < requiredIndexLen) {
            indexArray = new Uint32Array(requiredIndexLen);
            bufferGeometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
        } else {
            indexArray = indexAttr.array as Uint32Array;
        }
    
        // Fill index buffer
        indexArray.set(display_indices);
        bufferGeometry.index!.needsUpdate = true;
    
        // Optional: adjust draw range if the count changed
        bufferGeometry.setDrawRange(0, display_indices.length)
    }, [bufferGeometry])

    const applyUpdateIndices = useCallback(() => {
        updateIndices(face)
    }, [updateIndices, face])

    useUpdateWithGeometry(info, applyUpdateIndices)
    useEffect(() => applyUpdateIndices(), [])

    return (
        <mesh
            ref={ref}
            geometry={bufferGeometry}
            position={face.center}
            rotation={face.rotation} />
    )
})
