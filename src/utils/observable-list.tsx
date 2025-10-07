import { ObservableList } from "@code-essentials/utils"
import { EffectCallback, useEffect, useState } from "react"

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

export function useItemEffect<T>(list: ObservableList<T>, callback: (item: T) => ReturnType<EffectCallback>, deps?: any[]) {
    useEffect(() => {
        const removal = new Map<T, () => void>()
        const onInsert = (item: T) => {
            const remove = callback(item)
            if (remove)
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
        for(const item of list)
            onInsert(item)

        return () => {
            list.off("insert", onInsert)
            list.off("delete", onDelete)
        }
    }, [list, callback, ...(deps || [])])
}
