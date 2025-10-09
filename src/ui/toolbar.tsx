import { PropsWithChildren } from "react";
import styled from "@emotion/styled";
import { Overlay, OverlayCorner } from "./overlay.js";

export interface ToolbarProps extends PropsWithChildren {
}

const ToolbarContainer = styled.div`
    display: flex;
    flex-direction: row;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 8px 12px;
    margin: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    gap: 8px;
`;

export function Toolbar({ children }: ToolbarProps) {
    //TODO: let user reorder toolbars, move to different corner

    return (
        <Overlay corner={OverlayCorner.top_left}>
            <ToolbarContainer>
                {children}
            </ToolbarContainer>
        </Overlay>
    )
}
