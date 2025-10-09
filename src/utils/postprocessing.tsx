import { ObservableList } from "@code-essentials/utils";
import { createContext, JSX, PropsWithChildren, ReactNode, useContext, useMemo } from "react";
import { EffectComposer } from "@react-three/postprocessing";
import { useMembership } from "./observable-list";

const postprocessingChildrenContext = createContext<ObservableList<ReactNode> | null>(null)

interface CompositionProps {
    multisampling?: number
}

function Composition({
        multisampling,
    }: CompositionProps) {
    const postprocessingChildren = useContext(postprocessingChildrenContext)
    if (!postprocessingChildren)
        throw new Error('Composition must be used within a Composed')
    return (
        <EffectComposer
            multisampling={multisampling}
            children={postprocessingChildren as JSX.Element[]} />
    )
}

export interface ComposedProps extends CompositionProps, PropsWithChildren {
}

export function Composed({ children, multisampling }: PropsWithChildren<ComposedProps>) {
    const postprocessingChildren = useMemo<ObservableList<ReactNode>>(() => new ObservableList<ReactNode>(), [])

    return (
        <postprocessingChildrenContext.Provider value={postprocessingChildren}>
            {children}
            <Composition multisampling={multisampling} />
        </postprocessingChildrenContext.Provider>
    )
}

export function usePostProcessingEffects(...children: ReactNode[]) {
    const postprocessingChildren = useContext(postprocessingChildrenContext)
    if (!postprocessingChildren)
        throw new Error('usePostProcessingEffects must be used within a Composed')
    
    useMembership(postprocessingChildren, ...children)
}

export function PostProcessingEffect({ children }: PropsWithChildren) {
    // usePostProcessingEffects(children)
    return null
}
