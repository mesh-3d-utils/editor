import { ObservableList } from "@code-essentials/utils";
import { useEffect } from "react";
import { useContext } from "react";
import { useMemo } from "react";
import { createContext, PropsWithChildren } from "react";
import { EffectComposer } from "@react-three/postprocessing";
import { ReactNode } from "react";
import { JSX } from "react";

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

export function PostProcessingEffect({ children }: PropsWithChildren) {
    const postprocessingChildren = useContext(postprocessingChildrenContext)
    if (!postprocessingChildren)
        throw new Error('PostProcessingEffect must be used within a Composed')
    
    useEffect(() => {
        postprocessingChildren.push(children)
        return () => {
            const i = postprocessingChildren.indexOf(children);
            if (i >= 0) postprocessingChildren.splice(i, 1)
        }
    }, [postprocessingChildren])

    return null
}
