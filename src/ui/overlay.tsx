import { ObservableList } from "@code-essentials/utils"
import { createContext, PropsWithChildren, useContext, useEffect, useInsertionEffect, useState } from "react"

export enum OverlayCorner {
    top_left = 'top-left',
    top_right = 'top-right',
    bottom_left = 'bottom-left',
    bottom_right = 'bottom-right',
}

export interface OverlayProps {
    corner: OverlayCorner
    children: React.ReactNode
}

export function Overlay(overlay: OverlayProps) {
    const { overlays } = useOverlays()

    useInsertionEffect(() => {
        overlays.push(overlay)
        return () => {
            overlays.splice(overlays.indexOf(overlay), 1)
        }
    }, [overlays, overlay])

    return null
}

interface OverlayContext {
    overlays: ObservableList<OverlayProps>
    margin: number
    update(): void
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
        update: () => { }
    })

    // let any user of the overlays context update the overlays
    useEffect(() => {
        overlays.update = () => setOverlays({ ...overlays })
        
        overlays.overlays.on('insert', overlays.update)
        overlays.overlays.on('reorder', overlays.update)
        overlays.overlays.on('delete', overlays.update)
        return () => {
            overlays.overlays.off('insert', overlays.update)
            overlays.overlays.off('reorder', overlays.update)
            overlays.overlays.off('delete', overlays.update)
        }
    }, []) // overlays intentionally not included in deps

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

function OverlaysCornerRenderer({ corner }: OverlaysCornerRendererProps) {
    const { overlays } = useOverlays()

    return (
        <>
            {overlays.filter(overlay => overlay.corner === corner).map((overlay, i) => (
                <div key={i} style={{ position: 'absolute', top: 0, left: 0 }}>
                    {overlay.children}
                </div>
            ))}
        </>
    )
}
