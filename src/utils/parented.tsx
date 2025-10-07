import { Object3D } from "three"
import { PropsWithChildren, RefObject, useEffect, useState } from "react"
import { createPortal } from "@react-three/fiber"

export interface ParentedProps extends PropsWithChildren {
    parent: Object3D | RefObject<Object3D | null> | null | undefined
}

export function Parented({ children, parent }: ParentedProps) {
    const [resolvedParent, setResolvedParent] = useState<Object3D | null>(
        parent ?
            parent instanceof Object3D ?
                parent :
                "current" in parent ?
                    parent.current :
                    null :
            null
    )

    useEffect(() => {
        if (parent) {
            if (parent instanceof Object3D) {
                setResolvedParent(parent)
            } else if ("current" in parent) {
                const p = parent.current
                if (p)
                    setResolvedParent(p)
                else {
                    // Wait until the ref is assigned
                    const id = requestAnimationFrame(() => {
                        if (parent.current) setResolvedParent(parent.current)
                    })
                    return () => cancelAnimationFrame(id)
                }
            }
        }
        else {
            setResolvedParent(null)
        }
    }, [parent])

    return resolvedParent ? createPortal(children, resolvedParent) : null
}

export function isDescendantOf(object: Object3D, root: Object3D | null): boolean {
    if (!root)
        return false
    
    if (object === root)
        return true

    if (object.parent)
        return isDescendantOf(object.parent, root)
    
    return false
}
