import { ObservableList } from "@code-essentials/utils"
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Object3D } from "three"
import { isDescendantOf, useObservableList } from "../utils.js"
import { Toolbar } from "../ui/toolbar.js"
import { Select } from "../ui/select.js"
import { ThreeEvent, EventHandlers  } from "@react-three/fiber"

export interface InteractiveObject3D {
    listeners?: {
        [K in keyof EventHandlers]?: EventHandlers[K][]
    }
}

export function useInteractiveEvent<EventName extends keyof EventHandlers>(obj: InteractiveObject3D, event: EventName, listener: EventHandlers[EventName], deps?: any[]) {
    useEffect(() => {
        const listeners = obj.listeners ??= {}
        const handlers = listeners[event] ??= []
        handlers.push(listener)
        handlers.splice(handlers.indexOf(listener), 1)
    }, [obj, listener, ...(deps ?? [])])
}

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

    const onClick = useCallback((event: ThreeEvent<'click'>) => {
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

// export interface SelectToolProps {
//     mode: SelectionMode
// }

// export function SelectTool({ mode }: SelectToolProps) {
//     /**
//      * locate parent three obj this tool was mounted in
//      * 
//      * when scene background is clicked, clear selection
//      * 
//      * when object is clicked, add to selection
//      */

//     // obj_ref used to find scene background
//     const obj_ref = useRef<Object3D|null>(null)
//     const selection = useSelection()
//     const selectionInfo = useSelectionInfo()

//     useItemEffect(selectionInfo.selectableRoots, root => {
//         const handleObjectClick = (event: ThreeEvent) => {
//             const object = event.target

//             if (object instanceof Object3D) {
//                 if (selectionInfo.selectableRoots.some(root => isDescendantOf(object, root))) {
//                     switch (mode) {
//                         case SelectionMode.replace:
//                             selection.splice(0, selection.length)
//                             selection.push(object)
//                             break;
//                         case SelectionMode.add:
//                             selection.push(object)
//                             break;
//                         case SelectionMode.remove:
//                             const index = selection.indexOf(object)
//                             if (index !== -1)
//                                 selection.splice(index, 1)
//                             break;
//                     }
//                 }
//             }
//         }

//         //TODO: click does not exist on root object3D
//         root.addEventListener('click', handleObjectClick)
//         return () => {
//             root.removeEventListener('click', handleObjectClick)
//         }
//     }, [selectionInfo])

//     useEffect(() => {
//         const obj = obj_ref.current
//         if(!obj)
//             return

//         const handleBackgroundClick = () => {
//             selection.splice(0, selection.length)
//         }

//         //? how do you find scene root to intercept click event?
//         const scene_background = obj.parent
//         if (!scene_background)
//             return

//         scene_background.addEventListener('click', handleBackgroundClick)
//         return () => {
//             scene_background.removeEventListener('click', handleBackgroundClick)
//         }
//     }, [obj_ref])

//     return (
//         <object3D ref={obj_ref} />
//     )
// }

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
            {/* <SelectTool mode={mode} /> */}
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
