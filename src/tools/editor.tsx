import { OrbitControls, OrbitControlsProps } from "./orbit.js"
import { SelectControls, SelectControlsProps } from "./select.js"
import { TransformControls, TransformControlsProps } from "./transform.js"
import { GeometryEditControls, GeometryEditControlsProps } from "./geometry-edit.js"

export interface EditorControlsProps {
    orbit?: OrbitControlsProps
    select?: SelectControlsProps
    transform?: TransformControlsProps
    geometryEdit?: GeometryEditControlsProps
}

export function EditorControls({
        orbit = {},
        select = {},
        transform = {},
        geometryEdit = {},
    }: EditorControlsProps) {
    return (
        <>
            <OrbitControls {...orbit} />
            <SelectControls {...select} />
            <TransformControls {...transform} />
            <GeometryEditControls {...geometryEdit} />
        </>
    )
}
