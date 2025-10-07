import { OrbitControls, OrbitControlsProps } from "@react-three/drei"
import { SelectControls, SelectControlsProps } from "./select.js"
import { EditorTransformControls, EditorTransformControlsProps } from "./transform.js"
import { GeometryEditControls, GeometryEditControlsProps } from "./geometry-edit.js"

export interface EditorControlsProps {
    orbit?: boolean | OrbitControlsProps
    select?: SelectControlsProps
    transform?: EditorTransformControlsProps
    geometryEdit?: GeometryEditControlsProps
}

export function EditorControls({
        orbit = true,
        select = {},
        transform = {},
        geometryEdit = {},
    }: EditorControlsProps) {
    return (
        <>
            {orbit === true ? <OrbitControls enablePan enableZoom enableRotate /> : <OrbitControls {...orbit} />}
            <SelectControls {...select} />
            {/* <EditorTransformControls {...transform} /> */}
            {/* <GeometryEditControls {...geometryEdit} /> */}
        </>
    )
}
