import { Object3D, Scene } from "three"
import { Canvas, CanvasProps, EventHandlers, ThreeEvent, useThree } from "@react-three/fiber"
import { DependencyList, forwardRef, MutableRefObject, Ref, RefObject, useCallback, useEffect, useRef } from "react"

export interface InteractiveObject3D {
    listeners?: {
        [K in keyof EventHandlers]?: EventHandlers[K][]
    }
}

function interactionEventEffect<EventName extends keyof EventHandlers>(obj: Object3D, event: EventName, listener: EventHandlers[EventName]) {
    const listeners = (obj as InteractiveObject3D).listeners ??= {}
    const handlers = (listeners[event] ??= []) as EventHandlers[EventName][]
    handlers.push(listener)
    return () => {
        handlers.splice(handlers.indexOf(listener), 1)
    }
}

export function useObjectInteractionEvent<EventName extends keyof EventHandlers>(obj: Object3D, event: EventName, listener: EventHandlers[EventName], deps?: DependencyList) {
    useEffect(() => interactionEventEffect(obj, event, listener), [obj, listener, ...(deps ?? [])])
}

export function useInteractionEvent<EventName extends keyof EventHandlers>(ref: RefObject<Object3D|null>, event: EventName, listener: EventHandlers[EventName], deps?: DependencyList) {
    useEffect(() => {
        const obj = ref.current
        if (!obj)
            return

        return interactionEventEffect(obj, event, listener)
    }, [ref, listener, ...(deps ?? [])])
}

export const InteractiveCanvas = forwardRef<HTMLCanvasElement, CanvasProps>((props, ref) => {
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

    const eventHandlers: EventHandlers = {
    }

    const sceneRoot = useRef<Scene | null>(null)

    function setupEvent<EventName extends keyof EventHandlers>(eventName: EventName) {
        eventHandlers[eventName] = useCallback<NonNullable<EventHandlers[EventName]>>((event: Parameters<NonNullable<EventHandlers[EventName]>>[0]) => {
            // threejs event, could be listened to by useObjectInteractionEvent
            // the canvas is the eventObject, the interacted object is just object
            // the scene receives every event

            const objects =
                ('eventObject' in event) ?
                    [event.object] :
                    []
            
            for (const object of [...objects, sceneRoot.current!]) {
                const interactiveObject = object as InteractiveObject3D
                interactiveObject.listeners?.[eventName]?.forEach(handler => handler?.(event as any))
            }
        }, [sceneRoot]) as EventHandlers[EventName]
    }

    for (const eventName of eventNames)
        setupEvent(eventName)

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
