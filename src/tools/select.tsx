import { ObservableList } from "@code-essentials/utils"
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Object3D, Event as ThreeEvent } from "three"
import { isDescendantOf, useObservableList } from "../utils.js"
import { Toolbar } from "../ui/toolbar.js"
import { Select } from "../ui/select.js"

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
        <group ref={ref}>{children}</group>
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
    /**
     * locate parent three obj this tool was mounted in
     * 
     * when scene background is clicked, clear selection
     * 
     * when object is clicked, add to selection
     */
    const ref = useRef<Object3D>(null!)
    const selection = useSelection()
    const selectionInfo = useSelectionInfo()
    
useObservableList()

    useEffect(() => {

        function root_obj(object: Object3D): Object3D {
            if (!object.parent)
                return object
            return root_obj(object.parent)
        }

        const root = root_obj(obj)
        
        const handleBackgroundClick = () => {
            selection.splice(0, selection.length)
        }
        
        const handleObjectClick = (event: ThreeEvent) => {
            const object = event.target

            if (object instanceof Object3D) {
                if (selectionInfo.selectableRoots.some(root => isDescendantOf(object, root))) {
                    switch (mode) {
                        case SelectionMode.replace:
                            selection.splice(0, selection.length)
                            selection.push(object)
                            break;
                        case SelectionMode.add:
                            selection.push(object)
                            break;
                        case SelectionMode.remove:
                            const index = selection.indexOf(object)
                            if (index !== -1)
                                selection.splice(index, 1)
                            break;
                    }
                }
            }
        }

        //TODO: click does not exist on root object3D
        root.addEventListener('click', handleBackgroundClick)
        root.addEventListener('click', handleObjectClick)
        return () => {
            root.removeEventListener('click', handleBackgroundClick)
            root.removeEventListener('click', handleObjectClick)
        }
    }, [selectionInfo])

    return (
        <object3D ref={ref} />
    )
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
