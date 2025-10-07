import { ReactNode } from "react";
import { EditorControls, EditorControlsProps, Selectable, SelectionProvider, TransformInfoProvider } from "./tools/index.js";
import { EditorUI, EditorUIProps } from "./ui/editor.js";
import { OverlaysProvider } from "./ui/index.js";
import { InteractiveCanvas } from "./tools/interactive.jsx";
import { Composed } from "./utils/postprocessing.js";

export interface EditableProps {
    scene?: ReactNode
    controls?: EditorControlsProps
}

export function Editable({ scene, controls }: EditableProps) {
    return (
        <>
            <TransformInfoProvider>
                <SelectionProvider>
                    <Selectable>
                        {scene}
                    </Selectable>
                    <EditorControls {...controls} />
                </SelectionProvider>
            </TransformInfoProvider>
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
