import { ReactNode } from "react";
import { EditorControls, EditorControlsProps, Selectable, SelectControlsInfoProvider } from "./tools/index.js";
import { EditorUI, EditorUIProps } from "./ui/editor.js";
import { OverlaysProvider } from "./ui/index.js";
import { InteractiveCanvas } from "./utils/interactive.js";
import { Composed } from "./utils/postprocessing.js";

export interface EditableProps {
    scene?: ReactNode
    controls?: EditorControlsProps
}

export function Editable({ scene, controls }: EditableProps) {
    return (
        <>
            <SelectControlsInfoProvider>
                <Selectable>
                    {scene}
                </Selectable>
                <EditorControls {...controls} />
            </SelectControlsInfoProvider>
        </>
    )
}

export interface EditorProps extends EditableProps {
    ui?: EditorUIProps
}

export function Editor({ scene, controls, ui }: EditorProps) {
    return (
        <OverlaysProvider>
            <InteractiveCanvas>
                <Composed>
                    <Editable scene={scene} controls={controls} />
                </Composed>
            </InteractiveCanvas>
            <EditorUI {...ui} />
        </OverlaysProvider>
    )
}
