import { ObservableList } from "@code-essentials/utils"
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Mesh, Object3D, Color } from "three"
import { Toolbar } from "../ui/toolbar.js"
import { Select } from "../ui/select.js"
import { useThree } from "@react-three/fiber"
import { useObjectInteractionEvent } from "./interactive.js"
import { Outline, OutlineProps } from '@react-three/postprocessing';
import { memo } from "react"
import { PostProcessingEffect } from "../utils/postprocessing.js"
import { isDescendantOf, Parented } from "../utils/parented.js"
import { useObservableList } from "../utils/observable-list.js"

export interface SelectionInfo {
    readonly selection: ObservableList<Object3D>
    readonly selectableRoots: ObservableList<Object3D>
}

const selectionInfoContext = createContext<SelectionInfo | undefined>(undefined)

export interface SelectionProviderProps extends PropsWithChildren {
}

export function SelectionProvider({ children }: SelectionProviderProps) {
    const selectionInfo = useMemo<SelectionInfo>(() => ({
        selection: new ObservableList<Object3D>(),
        selectableRoots: new ObservableList<Object3D>(),
        selectionMode: SelectionMode.replace,
    }), [])

    return (
        <selectionInfoContext.Provider value={selectionInfo}>
            {children}
        </selectionInfoContext.Provider>
    )
}

export function useSelectionInfo() {
    const selectionInfo = useContext(selectionInfoContext)
    if (!selectionInfo)
        throw new Error('useSelectionInfo must be used within a SelectionProvider')
    return selectionInfo
}

export function useSelection() {
    const selectionInfo = useSelectionInfo()
    return useObservableList(selectionInfo.selection)
}

export function useIsSelected(object?: Object3D | undefined) {
    const selection = useSelection()
    return object ? selection.includes(object) : false
}

export interface SelectableProps extends PropsWithChildren {
}

export function Selectable({ children }: SelectableProps) {
    const ref = useRef<Object3D>(null!)
    const selectionInfo = useSelectionInfo()
    useEffect(() => {
        if (!selectionInfo.selectableRoots.includes(ref.current))
            selectionInfo.selectableRoots.push(ref.current)
        
        return () => {
            selectionInfo.selectableRoots.splice(selectionInfo.selectableRoots.indexOf(ref.current), 1)
        }
    }, [selectionInfo])

    return (
        <group ref={ref}>
            {children}
        </group>
    )
}

export enum SelectionMode {
    replace = 'replace',
    add = 'add',
    remove = 'remove',
}

export interface SelectToolProps {
    mode: SelectionMode
}

export function SelectTool({ mode }: SelectToolProps) {
    const selectionInfo = useSelectionInfo()
    const scene = useThree(s => s.scene)

    useObjectInteractionEvent(scene, 'onClick', event => {
        const {
            object,
        } = event

        if (object instanceof Object3D) {
            if (selectionInfo.selectableRoots.some(root => isDescendantOf(object, root))) {
                switch (mode) {
                    case SelectionMode.replace:
                        selectionInfo.selection.splice(0, selectionInfo.selection.length)
                        selectionInfo.selection.push(object)
                        break
                    case SelectionMode.add:
                        selectionInfo.selection.push(object)
                        break
                    case SelectionMode.remove:
                        const index = selectionInfo.selection.indexOf(object)
                        if (index !== -1)
                            selectionInfo.selection.splice(index, 1)
                        break
                }
            }
        }
    }, [selectionInfo])

    return null
}

export interface SelectControlsProps {
}

export function SelectControls({ }: SelectControlsProps) {
    const [mode, setMode] = useState<SelectionMode>(SelectionMode.replace)
    
    return (
        <>
            <SelectTool mode={mode} />
            <Toolbar>
                <Select
                    value={mode}
                    onChange={value => setMode(value as SelectionMode)}
                    items={[
                    { value: 'replace', text: 'Replace', icon: <>0</> },
                    { value: 'add', text: 'Add', icon: <>+</> },
                    { value: 'remove', text: 'Remove', icon: <>-</> },
                ]} />
            </Toolbar>
        </>
    )
}

export interface SelectionIndicatorProps {
    color: Color
    outline?: SelectionIndicatorOutlineProps
    tint?: SelectionIndicatorTintProps
}

export function SelectionIndicator({ color, outline, tint }: SelectionIndicatorProps) {
    return (
        <>
            {tint && <SelectionIndicatorTint {...{ color, ...tint }} />}
            {outline && <SelectionIndicatorOutline {...{ color, ...outline }} />}
        </>
    )
}

interface SelectionIndicatorImplPropsBase {
    color: Color
}

interface SelectionIndicatorTintProps {
    strength: number
}

type SelectionIndicatorTintImplProps = SelectionIndicatorTintProps & SelectionIndicatorImplPropsBase

function SelectionIndicatorTint(props: SelectionIndicatorTintImplProps) {
    const selection = useSelection()

    return (
        <>
            {selection.filter(obj => obj instanceof Mesh).map(obj => (
                <SelectionIndicatorTintObj key={obj.uuid} obj={obj} props={props} />
            ))}
        </>
    )
}

interface SelectionIndicatorTintObjProps {
    obj: Mesh
    props: SelectionIndicatorTintImplProps
}

const SelectionIndicatorTintObj = memo(({obj, props}: SelectionIndicatorTintObjProps) => {
    return (
        <Parented parent={obj}>
            <mesh
                // geometry is fixed and prepared because obj was selected by user
                geometry={obj.geometry}
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
                scale={[1, 1, 1]}
                renderOrder={999}>
                <meshBasicMaterial
                    color={props.color}
                    opacity={props.strength}
                    transparent
                    depthTest={false}
                    depthWrite={false}
                />
            </mesh>
        </Parented>
    )
})

interface SelectionIndicatorOutlineProps extends
    Pick<OutlineProps,
        | 'edgeStrength'
        | 'pulseSpeed'
        | 'blur'
        | 'xRay'
    > {
}

type SelectionIndicatorOutlineImplProps = SelectionIndicatorOutlineProps & SelectionIndicatorImplPropsBase

function SelectionIndicatorOutline({
        color,
        edgeStrength,
        pulseSpeed,
        blur,
        xRay,
    }: SelectionIndicatorOutlineImplProps) {
    const selection = useSelection()

    return (
        <PostProcessingEffect>
            <Outline
            selection={selection}
            visibleEdgeColor={color as any}
            hiddenEdgeColor={color as any}
            edgeStrength={edgeStrength}
            pulseSpeed={pulseSpeed}
            blur={blur}
            xRay={xRay}
            />
      </PostProcessingEffect>   
    )
}
