import { Object3D } from "three"
import { PropsWithChildren } from "react"
import { createPortal } from "@react-three/fiber"

export interface ParentedProps extends PropsWithChildren {
    parent: Object3D | null | undefined
}

export function Parented({ children, parent }: ParentedProps) {
    return parent ? createPortal(
        children,
        parent
    ) : null
}
