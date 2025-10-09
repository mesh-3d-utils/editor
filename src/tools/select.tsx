import { ObservableList } from "@code-essentials/utils"
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Mesh, Object3D, Color } from "three"
import { Toolbar } from "../ui/toolbar.js"
import { Select } from "../ui/select.js"
import { useThree } from "@react-three/fiber"
import { dispatchObjectEvent, useObjectInteractionEvent } from "./interactive.js"
import { Outline, OutlineProps } from '@react-three/postprocessing';
import { memo } from "react"
import { PostProcessingEffect } from "../utils/postprocessing.js"
import { isDescendantOfOrEqual, Parented } from "../utils/parented.js"
import { useItemEffect, useMembershipRef, useObservableList } from "../utils/observable-list.js"

export interface SelectionInfo {
    readonly selection: ObservableList<Object3D>
    readonly selectableRoots: ObservableList<Object3D>
    disabled?: boolean
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

export function useSelection<Observe extends boolean = true>(config?: { observe?: Observe }): Observe extends true ? Object3D[] : ObservableList<Object3D> {
    const { observe = true as Observe } = config ?? {}
    const selectionInfo = useSelectionInfo()
    if (observe)
        return useObservableList(selectionInfo.selection) as ReturnType<typeof useSelection<Observe>>
    else
        return selectionInfo.selection
}

export function useIsSelected(object: Object3D | undefined) {
    const selection = useSelection()
    return object ? selection.includes(object) : false
}

declare module './interactive.js' {
    export interface InteractiveObjectEventHandlers {
        onSelected(): void
        onDeselected(): void
        onSelectedChanged(selection: boolean): void
    }
}

function useRaiseSelectionEvents() {
    const selection = useSelection({ observe: false })
    
    useItemEffect(selection, object => {
        dispatchObjectEvent(object, 'onSelected')
        dispatchObjectEvent(object, 'onSelectedChanged', true)

        return () => {
            dispatchObjectEvent(object, 'onDeselected')
            dispatchObjectEvent(object, 'onSelectedChanged', false)
        }
    }, [selection])
}

export interface SelectableProps extends PropsWithChildren {
}

export function Selectable({ children }: SelectableProps) {
    const ref = useRef<Object3D|null>(null)
    const selectionInfo = useSelectionInfo()

    useMembershipRef(selectionInfo.selectableRoots, ref)

    return (
        <group ref={ref}>
            {children}
        </group>
    )
}

export enum SelectionMode {
    replace = 'replace',
    toggle = 'toggle',
    add = 'add',
    remove = 'remove',
}

export interface SelectToolProps {
    mode: SelectionMode
}

export function SelectTool({ mode }: SelectToolProps) {
    const selectionInfo = useSelectionInfo()
    const scene = useThree(s => s.scene)

    useObjectInteractionEvent(scene, 'onPointerMissed', event => {
        if (selectionInfo.disabled)
            return

        selectionInfo.selection.splice(0, selectionInfo.selection.length)
        event.stopPropagation()
    })

    useObjectInteractionEvent(scene, 'onClick', event => {
        if (selectionInfo.disabled)
            return

        const {
            object,
        } = event

        if (object instanceof Object3D) {
            if (selectionInfo.selectableRoots.some(root => isDescendantOfOrEqual(object, root))) {
                const selection = selectionInfo.selection
                const index = selection.indexOf(object)
                const includes = index !== -1

                //TODO: does react development mode twice fire event?
                // is this handled by three fiber?

                switch (mode) {
                    case SelectionMode.replace:
                        if (!(selection.length === 1 && selection[0] === object))
                            selectionInfo.selection.splice(0, selectionInfo.selection.length, object)
                        break
                    case SelectionMode.toggle:
                        if (includes)
                            selection.splice(index, 1)
                        else
                            selection.push(object)
                        break
                    case SelectionMode.add:
                        if (!includes)
                            selection.push(object)
                        break
                    case SelectionMode.remove:
                        if (includes)
                            selection.splice(index, 1)
                        break
                }

                event.stopPropagation()
            }
        }
    }, [selectionInfo])

    return null
}

export interface SelectControlsProps {
    indicator?: SelectionIndicatorProps
}

export function SelectControls({
        indicator = {
            color: new Color(0, 0.2, 1),
            // outline: {
            // }
        }
    }: SelectControlsProps) {
    const [mode, setMode] = useState<SelectionMode>(SelectionMode.replace)
    useRaiseSelectionEvents()

    return (
        <>
            <SelectTool mode={mode} />
            <Toolbar>
                <Select
                    value={mode}
                    onChange={value => setMode(value as SelectionMode)}
                    items={[
                    { value: SelectionMode.replace, text: 'Replace', icon: <>0</> },
                    { value: SelectionMode.add, text: 'Add', icon: <>+</> },
                    { value: SelectionMode.remove, text: 'Remove', icon: <>-</> },
                ]} />
            </Toolbar>
            <SelectionIndicator key='indicator' {...indicator} />
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
                name="selection-indicator-tint"
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
