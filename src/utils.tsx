import { ObservableList } from "@code-essentials/utils"
import { useEffect, useState } from "react"
import { Object3D } from "three"

export function useObservableList<T>(list: ObservableList<T>) {
    const [, forceUpdate] = useState({})

    useEffect(() => {
        const update = () => forceUpdate({})
        list.on("insert", update)
        list.on("delete", update)
        list.on("reorder", update)
        return () => {
            list.off("insert", update)
            list.off("delete", update)
            list.off("reorder", update)
        }
    }, [list])

    return list
}

export function useItemEffect<T>(list: ObservableList<T>, callback: (item: T) => (() => void)) {
    useEffect(() => {
        list.forEach(callback)
        const removal = new Map<T, () => void>()
        const onInsert = (item: T) => {
            const remove = callback(item)
            removal.set(item, remove)
        }
        const onDelete = (item: T) => {
            const remove = removal.get(item)
            if (remove)
                remove()
            removal.delete(item)
        }
        list.on("insert", onInsert)
        list.on("delete", onDelete)
        return () => {
            list.off("insert", onInsert)
            list.off("delete", onDelete)
        }
    }, [list, callback])
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
