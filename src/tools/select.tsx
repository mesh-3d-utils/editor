import { ObservableList } from "@code-essentials/utils"
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Object3D } from "three"
import { isDescendantOf, useObservableList } from "../utils.js"
import { Toolbar } from "../ui/toolbar.js"
import { Select } from "../ui/select.js"
import { EventHandlers } from "@react-three/fiber"

export interface SelectionInfo {
    readonly selection: ObservableList<Object3D>
    readonly selectableRoots: ObservableList<Object3D>
    selectionMode: SelectionMode
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

    const onClick = useCallback<NonNullable<EventHandlers['onClick']>>(event => {
        const {
            object,
        } = event

        if (object instanceof Object3D) {
            if (selectionInfo.selectableRoots.some(root => isDescendantOf(object, root))) {
                switch (selectionInfo.selectionMode) {
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

    return (
        <group ref={ref} onClick={onClick}>
            {children}
        </group>
    )
}

export enum SelectionMode {
    replace = 'replace',
    add = 'add',
    remove = 'remove',
}

export interface SelectControlsProps {
}

export function SelectControls({ }: SelectControlsProps) {
    const [mode, setMode] = useState<SelectionMode>(SelectionMode.replace)
    const selectionInfo = useSelectionInfo()
    useEffect(() => {
        selectionInfo.selectionMode = mode
    }, [mode])

    return (
        <>
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
