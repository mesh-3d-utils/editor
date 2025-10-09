import { RefObject, useEffect, useState } from "react";

export function useRefResolved<T>(ref: RefObject<T | undefined | null>): T | undefined | null {
    const [resolved, setResolved] = useState(ref.current)

    useEffect(() => {
        if (ref.current !== null && ref.current !== undefined)
            setResolved(ref.current)
        else {
            // Wait until the ref is assigned
            const id = requestAnimationFrame(() => {
                if (ref.current !== null && ref.current !== undefined)
                    setResolved(ref.current)
            })
            return () => cancelAnimationFrame(id)
        }
    }, [ref])

    return resolved
}
