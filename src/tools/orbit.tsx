import { OrbitControls as ImplOrbitControls, OrbitControlsProps as ImplOrbitControlsProps } from "@react-three/drei";
import { useIsTransforming } from "./transform.js";

export type OrbitToolProps = ImplOrbitControlsProps

export function OrbitTool(props: OrbitToolProps) {
    const transforming = useIsTransforming()
    console.log(`transforming: ${transforming}`)
    
    return (<ImplOrbitControls enablePan enableZoom enableRotate {...props} enabled={!transforming} />)
}

export type OrbitControlsProps = OrbitToolProps

export function OrbitControls(props: OrbitControlsProps) {
    return (<OrbitTool {...props} />)
}
