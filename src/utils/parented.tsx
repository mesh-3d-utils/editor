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

export function isDescendantOf(object: Object3D, root: Object3D, separators: Object3D[] = []): boolean {
    if (object.parent)
        return isDescendantOfOrEqual(object.parent, root, separators)
    
    return false
}

export function isDescendantOfOrEqual(object: Object3D, root: Object3D, separators: Object3D[] = []): boolean {
    if (separators.includes(object))
        return false

    if (object === root)
        return true
    
    if (object.parent)
        return isDescendantOfOrEqual(object.parent, root, separators)
    
    return false
}

export function deepestChild(objects: Object3D[]): Object3D | null {
    objects = [...objects]
    for (let i = 0; i < objects.length; i++) {
        const o = objects[i]
        if (objects.some(child => isDescendantOf(child, o)))
            objects.splice(i--, 1)
    }

    return objects[0]
}
