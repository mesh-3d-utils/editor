import * as THREE from 'three'
import { Object3D, Object3DEventMap, Scene } from "three"
import { Canvas, CanvasProps, EventHandlers as ThreeFiberEventHandlersImpl, useThree } from "@react-three/fiber"
import { forwardRef, RefObject, useEffect, useMemo, useRef } from "react"
import { useRefResolved } from "./obj.js"

export type ThreeFiberEventProps = Required<ThreeFiberEventHandlersImpl>

export type ThreeFiberEventHandlers = ThreeFiberEventProps

export type ThreeFiberObject3DEventHandlers = Omit<ThreeFiberEventHandlers, 'onPointerMissed'>

type ThreeFiberEvents = {
    [K in keyof ThreeFiberEventHandlers]: Parameters<ThreeFiberEventHandlers[K]>[0]
}

type ThreeExtensionEvents = {
    [K in keyof ThreeFiberEvents]: ThreeFiberEvents[K] & {
        type: K
    }
}

declare module "three" {
    export interface Object3DEventMap extends ThreeExtensionEvents { }
}

export type EventBubbles<Bubbles extends boolean, Event> = {
    bubbles: Bubbles
} & Event

export type EventMapBubbles<Bubbles extends boolean, Events extends object> = {
    [K in keyof Events]: EventBubbles<Bubbles, Events[K]>
}

export function dispatchEventBubbled(object: Object3D, event: THREE.Object3DEventMap[keyof THREE.Object3DEventMap]) {
    if ((event as EventBubbles<boolean, THREE.Object3DEventMap>).bubbles) {
        let target: Object3D | null = object
        
        while (target && !((event as any).cancelBubble ?? false)) {
            // Update currentTarget for each dispatchee
            (event as any).currentTarget = target
            
            target.dispatchEvent(event as any)
            
            // Stop if propagation was stopped
            if ((event as any).cancelBubble)
                break
            
            target = target.parent
        }
    }
    else
        object.dispatchEvent(event as any)
}

export function useEvent<E extends keyof THREE.Object3DEventMap>(
        object: Object3D | null | RefObject<Object3D | null>,
        event: E,
        listener: THREE.EventListener<THREE.Object3DEventMap[E], E, Object3D<Object3DEventMap>>,
    ) {
    const obj = object && ('current' in object) ?
        useRefResolved(object) :
        object

    useEffect(() => {
        if (!obj)
            return
        obj.addEventListener(event, listener)
        return () => {
            obj.removeEventListener(event, listener)
        }
    }, [obj, event, listener])
}

const stopPropagation = (e: Event) => e.stopPropagation()
export function useEventsIgnored<EventName extends keyof Object3DEventMap>(
        object: Object3D | null | RefObject<Object3D | null>,
        events: readonly EventName[],
    ): Object3DEventMap[EventName] extends { stopPropagation(): any } ? void : never {
    const obj = object && ('current' in object) ?
        useRefResolved(object) :
        object
    
    useEffect(() => {
        if (!obj)
            return
        for (const event of events)
            obj.addEventListener(event, stopPropagation as any)
        return () => {
            for (const event of events)
                obj.removeEventListener(event, stopPropagation as any)
        }
    }, [obj, events, stopPropagation])

    return undefined as ReturnType<typeof useEventsIgnored<EventName>>
}

export function usePointerEventsIgnored(
        object: Object3D | null | RefObject<Object3D | null>,
    ) {
    return useEventsIgnored(object, [
        'onClick',
        'onContextMenu',
        'onDoubleClick',
        'onPointerUp',
        'onPointerDown',
        'onPointerOver',
        'onPointerOut',
        'onPointerEnter',
        'onPointerLeave',
        'onPointerMove',
        'onPointerMissed',
        'onPointerCancel',
        'onWheel',
        'onLostPointerCapture',
    ])
}

/** forwards events from react three fiber to threejs event system */
export function useThreeFiberEvents(ref: RefObject<Object3D|null>) {
    return useMemo(() => {
        const eventNames: readonly (keyof ThreeFiberEventProps)[] = [
            'onClick',
            'onContextMenu',
            'onDoubleClick',
            'onPointerUp',
            'onPointerDown',
            'onPointerOver',
            'onPointerOut',
            'onPointerEnter',
            'onPointerLeave',
            'onPointerMove',
            'onPointerMissed',
            'onPointerCancel',
            'onWheel',
            'onLostPointerCapture',
        ] as const

        const eventHandlers: Partial<ThreeFiberEventProps> = {
        }

        function setupEvent<EventName extends keyof ThreeFiberEventProps>(eventName: EventName) {
            eventHandlers[eventName] = ((event: ThreeFiberEvents[EventName]) => {
                const object =
                    (event && ('eventObject' in event)) ?
                        event.object :
                        ref.current!

                const uncopied: (keyof ThreeFiberEvents[EventName])[] = [
                    'target',
                    'currentTarget',
                ]

                // Create a proxy that delegates method calls back to the original DOM event
                const threeEvent = new Proxy({
                    ...event,
                    type: eventName
                } as ThreeExtensionEvents[EventName], {
                    get(target, prop) {
                        // If it's a method that exists on the original event, delegate to it
                        if (prop in event && typeof (event as any)[prop] === 'function') {
                            return (event as any)[prop].bind(event)
                        }
                        return (target as any)[prop]
                    },
                    set(target, prop, value) {
                        // Sync state changes back to the original event
                        if (prop in event && !uncopied.includes(prop as keyof ThreeFiberEvents[EventName])) {
                            (event as any)[prop] = value
                        }
                        (target as any)[prop] = value
                        return true
                    }
                })

                dispatchEventBubbled(object, threeEvent)
            }) as any
        }

        for (const eventName of eventNames)
            setupEvent(eventName)

        return eventHandlers as ThreeFiberEventProps
    }, [ref])
}

export const InteractiveCanvas = forwardRef<HTMLCanvasElement, CanvasProps>((props, ref) => {
    const sceneRoot = useRef<Scene | null>(null)
    const eventHandlers = useThreeFiberEvents(sceneRoot)
    
    const propsWithoutChildren = { ...props }
    delete propsWithoutChildren.children
    
    return (
        <Canvas ref={ref}
            // onPointerMissed does not apply to object3D's
            onPointerMissed={eventHandlers.onPointerMissed}
            {...propsWithoutChildren}>
            <SceneRootObserver root={sceneRoot} />
            <object3D {...eventHandlers}>
                {props.children}
            </object3D>
        </Canvas>
    )
})

interface SceneRootObserverProps {
    root: RefObject<Object3D|null>
}

function SceneRootObserver({ root }: SceneRootObserverProps) {
    root.current = useThree(s => s.scene)
    return null
}
