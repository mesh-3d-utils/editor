import { Object3D, Object3DEventMap, EventListener } from 'three'
import { useEffect } from 'react'

export function useEvent<E extends keyof Object3DEventMap>(object: Object3D, event: E, listener: EventListener<Object3DEventMap[E], E, Object3D<Object3DEventMap>>) {
    useEffect(() => {
        object.addEventListener(event, listener)
        return () => {
            object.removeEventListener(event, listener)
        }
    }, [object, event, listener])
}
