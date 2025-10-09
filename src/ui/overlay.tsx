import { ObservableList } from "@code-essentials/utils"
import { createContext, memo, PropsWithChildren, ReactNode, useContext, useEffect, useState } from "react"
import { useMembership, useObservableList } from "../utils/observable-list"

export enum OverlayCorner {
    top_left = 'top-left',
    top_right = 'top-right',
    bottom_left = 'bottom-left',
    bottom_right = 'bottom-right',
}

export interface OverlayProps {
    corner: OverlayCorner
    children: ReactNode
}

export function useOverlay(overlay: OverlayProps) {
    const { overlays } = useOverlays()
    useMembership(overlays, overlay)
}

export function Overlay(overlay: OverlayProps) {
    useOverlay(overlay)
    return null
}

interface OverlayContext {
    overlays: ObservableList<OverlayProps>
    margin: number
}

const context = createContext<OverlayContext | undefined>(undefined)

function useOverlays() {
    const overlays = useContext(context)
    if (!overlays)
        throw new Error('useOverlays must be used within an OverlaysProvider')
    return overlays
}

export interface OverlaysProviderProps extends PropsWithChildren {
    margin?: number
}

export function OverlaysProvider({ children, margin = 10 }: OverlaysProviderProps) {
    const [overlays, setOverlays] = useState<OverlayContext>({
        overlays: new ObservableList<OverlayProps>(),
        margin,
    })

    useEffect(() => {
        if (margin !== overlays.margin)
            setOverlays({ ...overlays, margin })
    }, [margin])

    return (
        <context.Provider value={overlays}>
            {children}
        </context.Provider>
    )
}

export function OverlaysRenderer() {
    const { margin } = useOverlays()

    return (
        <>
            <div style={{ position: 'absolute', top: margin, left: margin }}>
                <OverlaysCornerRenderer corner={OverlayCorner.top_left} />
            </div>
            <div style={{ position: 'absolute', top: margin, right: margin }}>
                <OverlaysCornerRenderer corner={OverlayCorner.top_right} />
            </div>
            <div style={{ position: 'absolute', bottom: margin, left: margin }}>
                <OverlaysCornerRenderer corner={OverlayCorner.bottom_left} />
            </div>
            <div style={{ position: 'absolute', bottom: margin, right: margin }}>
                <OverlaysCornerRenderer corner={OverlayCorner.bottom_right} />
            </div>
        </>
    )
}

interface OverlaysCornerRendererProps {
    corner: OverlayCorner
}

const OverlaysCornerRenderer = memo(({ corner }: OverlaysCornerRendererProps) => {
    const { overlays } = useOverlays()
    useObservableList(overlays)

    return (
        <>
            {overlays.filter(overlay => overlay.corner === corner).map((overlay, i) => (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {overlay.children}
                </div>
            ))}
        </>
    )
})
