import { PropsWithChildren } from "react";
import { Overlay, OverlayCorner } from "./overlay";

export interface ToolbarProps extends PropsWithChildren {
}

export function Toolbar({ children }: ToolbarProps) {
    //TODO: let user reorder toolbars, move to different corner
    // children are layed out horizontally
    
    return (
        <>
            <Overlay corner={OverlayCorner.top_left}>
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                    {children}
                </div>
            </Overlay>
        </>
    )
}
