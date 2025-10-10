import { Object3D, Scene } from "three"
import { Canvas, CanvasProps, EventHandlers, useThree } from "@react-three/fiber"
import { DependencyList, forwardRef, RefObject, useCallback, useEffect, useMemo, useRef } from "react"

export interface InteractiveObject3D {
    listeners?: {
        [K in keyof InteractiveObjectEventHandlers]?: InteractiveObjectEventHandlers[K][]
    }
}

type ThreeFiberEventHandlers = Required<Omit<EventHandlers, 'onPointerMissed'>>

export interface InteractiveObjectEventHandlers extends ThreeFiberEventHandlers {
}

export type EventArgs = {
    [EventName in keyof InteractiveObjectEventHandlers]-?: Parameters<NonNullable<InteractiveObjectEventHandlers[EventName]>>
}

export function dispatchObjectEvent<EventName extends keyof InteractiveObjectEventHandlers>(object: Object3D, event: EventName, ...args: EventArgs[EventName]) {
    const obj = object as InteractiveObject3D
    for (const listener of obj.listeners?.[event] ?? [])
        ///@ts-ignore
        listener?.(...args)
}

function interactionEventEffect<EventName extends keyof InteractiveObjectEventHandlers>(obj: Object3D, event: EventName, listener: InteractiveObjectEventHandlers[EventName]) {
    const listeners = (obj as InteractiveObject3D).listeners ??= {}
    const handlers = (listeners[event] ??= []) as InteractiveObjectEventHandlers[EventName][]
    handlers.push(listener)
    return () => {
        handlers.splice(handlers.indexOf(listener), 1)
    }
}

export function useObjectInteractionEvent<EventName extends keyof InteractiveObjectEventHandlers>(obj: Object3D | null | undefined, event: EventName, listener: InteractiveObjectEventHandlers[EventName], deps?: DependencyList) {
    useEffect(() => {
        if (obj)
            return interactionEventEffect(obj, event, listener)
    }, [obj, listener, ...(deps ?? [])])
}

export function useInteractionEvent<EventName extends keyof InteractiveObjectEventHandlers>(ref: RefObject<Object3D|null>, event: EventName, listener: InteractiveObjectEventHandlers[EventName], deps?: DependencyList) {
    useEffect(() => {
        const obj = ref.current
        if (!obj)
            return

        return interactionEventEffect(obj, event, listener)
    }, [ref, listener, ...(deps ?? [])])
}

/**
 * responds to an event, to make a virtual object if fitting
 * 
 * virtual object is made child of real object and event is dispatched to it
 */
export type VirtualObjectFactory = <EventName extends keyof ThreeFiberEventHandlers>(eventName: EventName, ...args: EventArgs[EventName]) => Object3D | null | undefined

function eventInterceptor<EventName extends keyof ThreeFiberEventHandlers>(eventName: EventName, virtualObjectFactory: VirtualObjectFactory) {
    return useCallback((...args: EventArgs[EventName]) => {
        const object = virtualObjectFactory(eventName, ...args)
        if (object) {
            args[0].object = object
        }
    }, [virtualObjectFactory])
}

export function useVirtualObject(virtualObjectFactory: VirtualObjectFactory) {
    

    const listeners = {
        onPointerMove: eventInterceptor('onPointerMove', virtualObjectFactory),
    } as const satisfies Partial<ThreeFiberEventHandlers>

    return listeners as Pick<ThreeFiberEventHandlers, keyof typeof listeners>
}

export const InteractiveCanvas = forwardRef<HTMLCanvasElement, CanvasProps>((props, ref) => {
    const sceneRoot = useRef<Scene | null>(null)
    
    const eventHandlers = useMemo(() => {
        const eventNames: readonly (keyof EventHandlers)[] = [
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

        const eventHandlers: Partial<EventHandlers> = {
        }

        function setupEvent<EventName extends keyof EventHandlers>(eventName: EventName) {
            eventHandlers[eventName] = ((event: Parameters<Required<EventHandlers>[EventName]>[0]) => {
                // threejs event, could be listened to by useObjectInteractionEvent
                // the canvas is the eventObject, the interacted object is just object
                // the scene receives every event

                const objects =
                    (event && ('eventObject' in event)) ?
                        [event.object] :
                        []
            
                for (const object of [...objects, sceneRoot.current!])
                    dispatchObjectEvent(object, eventName as keyof InteractiveObjectEventHandlers, event as any)
            })
        }

        for (const eventName of eventNames)
            setupEvent(eventName)

        return eventHandlers
    }, [sceneRoot])

    const propsWithoutChildren = { ...props }
    delete propsWithoutChildren.children
    
    return (
        <Canvas ref={ref}
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
