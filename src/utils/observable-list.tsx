import { ObservableList } from "@code-essentials/utils"
import { DependencyList, RefObject, useEffect, useMemo, useRef, useState } from "react"
import { useRefResolved } from "./ref"

export function useObservableList<T>(list: ObservableList<T>) {
    const [list_, setList_] = useState(list.slice())

    useEffect(() => {
        const update = () => setList_(list.slice())
        list.on("insert", update)
        list.on("delete", update)
        list.on("reorder", update)
        return () => {
            list.off("insert", update)
            list.off("delete", update)
            list.off("reorder", update)
        }
    }, [list])

    return list_
}

export function useObservableListMapped<T1, T2>(src: ObservableList<T1>, map: (item: T1) => T2, deps: DependencyList = []) {
    const res = useMemo(() => new ObservableList<T2>(), [])

    useItemEffect(src, item => {
        const mapped = map(item)
        res.push(mapped)
        return () => {
            const index = res.indexOf(mapped)
            if (index !== -1)
                res.splice(index, 1)
        }
    }, [src, map, ...deps])

    return res
}

const start = Symbol()
export function useMembership<T>(list: ObservableList<T>, ...members: (T | undefined | null)[]) {
    const insertAfter = useRef<T | typeof start | undefined>(undefined)

    useEffect(() => {
        const members_= members.filter<T>(_ => _ !== undefined && _ !== null)
        
        let insertIndex = list.length
        if (insertAfter.current) {
            if (insertAfter.current === start)
                insertIndex = 0
            else {
                const index = list.indexOf(insertAfter.current)
                if (index >= 0)
                    insertIndex = index + 1
            }
        }
        
        insertAfter.current =
            insertIndex === 0 ?
                start :
                list[insertIndex - 1]
        
        list.splice(insertIndex, 0, ...members_)

        return () => {
            if (members_.length === 0)
                return

            for (const member of members_) {
                const index = list.indexOf(member)
                if (index !== -1)
                    list.splice(index, 1)
            }
        }
    }, [list, ...members])
}

export function useMembershipRef<T>(list: ObservableList<T>, memberRef: RefObject<T | undefined | null>) {
    const member = useRefResolved(memberRef)
    useMembership(list, member)
}

export type Destructor = () => void

export function useItemEffect<T>(list: ObservableList<T>, callback: (item: T) => void | Destructor, deps?: any[]) {
    const destructors = useMemo(() => new Map<T, Destructor[]>(), [])

    useEffect(() => {
        const onInsert = (item: T) => {
            const res = callback(item)
            if (res) {
                const destructors_item = destructors.get(item) ?? destructors.set(item, []).get(item)!
                destructors_item.push(res)
            }
        }

        const onDelete = (item: T) => {
            const destructors_item = destructors.get(item)
            if (!destructors_item)
                return

            destructors_item.forEach(destructor => destructor?.())
            destructors.delete(item)
        }

        list.on("insert", onInsert)
        list.on("delete", onDelete)
        
        for (const item of list)
            onInsert(item)

        return () => {
            list.off("insert", onInsert)
            list.off("delete", onDelete)
        }
    }, [list, callback, ...(deps || [])])
}
