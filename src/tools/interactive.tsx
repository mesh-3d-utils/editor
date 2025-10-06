import { Object3D } from "three"
import { EventHandlers } from "@react-three/fiber"
import { Ref, useEffect } from "react"

export interface InteractiveObject3D {
    listeners?: {
        [K in keyof EventHandlers]?: EventHandlers[K][]
    }
}

export function useObjectInteractionEvent<EventName extends keyof EventHandlers>(obj: InteractiveObject3D, event: EventName, listener: EventHandlers[EventName], deps?: any[]) {
    useEffect(() => {
        const listeners = obj.listeners ??= {}
        const handlers = (listeners[event] ??= []) as EventHandlers[EventName][]
        handlers.push(listener)
        return () => {
            handlers.splice(handlers.indexOf(listener), 1)
        }
    }, [obj, listener, ...(deps ?? [])])
}

export function useInteractionEvent<EventName extends keyof EventHandlers>(ref: Ref<Object3D|null>, event: EventName, listener: EventHandlers[EventName], deps?: any[]) {
    useEffect(() => {
        const obj = ref.current
        if (!obj)
            return

        const listeners = obj.listeners ??= {}
        const handlers = (listeners[event] ??= []) as EventHandlers[EventName][]
        handlers.push(listener)
        return () => {
            handlers.splice(handlers.indexOf(listener), 1)
        }
    }, [ref, listener, ...(deps ?? [])])
}
