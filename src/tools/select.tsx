import { ObservableList } from "@code-essentials/utils"
import { createContext, PropsWithChildren, RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Mesh, Object3D, Color } from "three"
import { Toolbar } from "../ui/toolbar.js"
import { Select } from "../ui/select.js"
import { useThree } from "@react-three/fiber"
import { Outline, OutlineProps } from '@react-three/postprocessing';
import { memo } from "react"
import { PostProcessingEffect } from "../utils/postprocessing.js"
import { deepestChild, isDescendantOf, Parented } from "../utils/parented.js"
import { useMembershipRef, useObservableList, useObservableSubset } from "../utils/observable-list.js"
import { useRefResolved } from "../utils/obj.js"
import { useEvent } from "../utils/interactive.js"

export interface SelectControlsInfo {
    readonly selection: ObservableList<Object3D>
    readonly selectables: SelectableInfo[]
    mode: SelectionMode
    disabled?: boolean
}

const selectContext = createContext<SelectControlsInfo | undefined>(undefined)

export function SelectControlsInfoProvider({ children }: PropsWithChildren) {
    const value = useMemo<SelectControlsInfo>(() => ({
        selection: new ObservableList(),
        selectables: [],
        mode: SelectionMode.replace,
    }), [])

    return (
        <selectContext.Provider value={value}>
            {children}
        </selectContext.Provider>
    )
}

export function useSelectControlsInfo() {
    const selectionInfo = useContext(selectContext)
    if (!selectionInfo)
        throw new Error('useSelectControlsInfo must be used within a SelectControlsInfoProvider')
    return selectionInfo
}

declare module 'three' {
    interface Object3DEventMap {
        onSelected: {
            object: Object3D
        }
        onDeselected: {
            object: Object3D
        }
    }
}

export interface SelectableProps {
    readonly isolateSelections: boolean
}

export type SelectableComponentProps = Partial<SelectableProps> & PropsWithChildren

export interface SelectableInfo extends SelectableProps {
    /**
     * root of this selectable
     */
    readonly container: Object3D
    
    readonly parent?: SelectableInfo | null

    /**
     * selection of items within this selectable
     */
    readonly selection: ObservableList<Object3D>
}

const selectableContext = createContext<SelectableInfo>(undefined!)


function globalSelectable(selectable: SelectableInfo): SelectableInfo {
    if (selectable.isolateSelections)
        return selectable
    else if (selectable.parent)
        return globalSelectable(selectable.parent)
    else
        return selectable
}

function useLocalSelectableTo(where: Object3D | RefObject<Object3D | null>) {
    const object = where instanceof Object3D ? where : useRefResolved(where)
    const selectControls = useSelectControlsInfo()
    const selectables = object ? selectControls.selectables.filter(s => isDescendantOf(object, s.container)) : []
    if (!selectables.length)
        throw new Error('useLocalSelectableTo: object not in any selectable')

    const deepest_container = deepestChild(selectables.map(s => s.container))
    return selectables.find(s => s.container === deepest_container)!
}

export function useLocalSelectable(where?: Object3D | RefObject<Object3D | null>) {
    if (where)
        return useLocalSelectableTo(where)

    return useContext(selectableContext)
}

export function useGlobalSelectable(where?: Object3D | RefObject<Object3D | null>) {
    return globalSelectable(useLocalSelectable(where))
}

export function useContainerSelectable(containerRef: RefObject<Object3D | null>, props: SelectableProps) {
    const selectControls = useSelectControlsInfo()
    const container = useRefResolved(containerRef)
    const selectableInfoRef = useRef<SelectableInfo|null>(null)
    const selection = useMemo(() => new ObservableList<Object3D>(), [])
    const parent = useContext(selectableContext)
    const selectControlsInfo = useSelectControlsInfo()

    useEffect(() => {
        if (!container)
            return

        selectableInfoRef.current = {
            container,
            selection,
            ...props,
        }

        //TODO: should destructor appear here?
        return () => {
            selection.splice(0, selection.length)
        }
    }, [container, props, selection])

    useMembershipRef(selectControls.selectables, selectableInfoRef)
    useObservableSubset(parent?.selection ?? selectControlsInfo.selection, selection)

    useEvent(containerRef, 'onClick', event => {
        if (selectControls.disabled)
            return

        const { object } = event

        if (!(object instanceof Object3D))
            return

        const selection_global = globalSelectable(selectableInfoRef.current!).selection
        const selection_local = selection
        const index_global = selection_global.indexOf(object)
        const index_local = selection_local.indexOf(object)
        const includes_global = index_global !== -1
        const includes_local = index_local !== -1
        
        switch (selectControls.mode) {
            case SelectionMode.replace:
                for (let i = 0; i < selection_global.length; i++)
                    if (i !== index_local)
                        selection_global.splice(i--, 1)
                
                if (!includes_local)
                    selection_local.push(object)

                break
            case SelectionMode.toggle:
                // react development mode fires event twice
                // unhandled currently

                if (includes_global)
                    selection_global.splice(index_global, 1)
                else
                    selection_local.push(object)
                break
            case SelectionMode.add:
                if (!includes_local)
                    selection_global.push(object)
                break
            case SelectionMode.remove:
                if (includes_global)
                    selection_global.splice(index_global, 1)
                break
        }

        event.stopPropagation()
    })

    return selectableInfoRef.current
}

export function Selectable({
        children,
        isolateSelections = false,
    }: SelectableComponentProps) {
    const containerRef = useRef<Object3D | null>(null)
    const props = useMemo<SelectableProps>(() => ({
        isolateSelections,
    }), [isolateSelections])
    const selectable = useContainerSelectable(containerRef, props)

    return (
        <group ref={containerRef} name="selection-root">
            {selectable && <selectableContext.Provider value={selectable}>
                {children}
            </selectableContext.Provider>}
        </group>
    )
}

export function useSelection<Observe extends boolean = true>(config?: {
        observe?: Observe,
        where?: Object3D | RefObject<Object3D | null>,
    }): Observe extends true ? Object3D[] : ObservableList<Object3D> {
    const { observe = true as Observe, where } = config ?? {}
    const selectable = useLocalSelectable(where)
    const selection = selectable?.selection ?? useSelectControlsInfo().selection

    if (observe)
        return useObservableList(selection) as ReturnType<typeof useSelection<Observe>>
    else
        return selection
}

export function useIsSelected(
        object: Object3D | null | RefObject<Object3D | null>,
        observe: ((selection: boolean) => void) | boolean = true,
    ) {
    const object_ = object ?
        object instanceof Object3D ? object : useRefResolved(object) :
        null

    if (typeof observe === 'function') {
        useEvent(object, 'onSelected', useCallback(() => observe(true), []))
        useEvent(object, 'onDeselected', useCallback(() => observe(false), []))
    }
    
    const selection = useSelection({ observe: observe === true })
    return object_ ? selection.includes(object_) : false
}

export enum SelectionMode {
    replace = 'replace',
    toggle = 'toggle',
    add = 'add',
    remove = 'remove',
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
    const controls = useSelectControlsInfo()
    const scene = useThree(s => s.scene)

    useEvent(scene, 'onPointerMissed', e => {
        if (controls.disabled)
            return

        // separate into islands
        const selectables = [...controls.selectables]
        for (let i = 0; i < selectables.length; i++) {
            const selectable = selectables[i]
            if (selectables.some(other => isDescendantOf(selectable.container, other.container)))
                selectables.splice(i--, 1)
        }

        for (const selectable of selectables)
            selectable.selection.splice(0, selectable.selection.length)

        e.stopPropagation()
    })

    return (
        <>
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
