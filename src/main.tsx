import { createRoot } from 'react-dom/client'
import { Editor } from './editor.js'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { useRef } from 'react'
import { Object3D } from 'three'
import { Parented } from './utils/parented.js'

function Scene() {
    const box = useRef<Object3D|null>(null)

    return (
        <>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />

            <mesh name='box1' ref={box} position={[0, 0, 0]}>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial color="blue" />
            </mesh>

            <Parented parent={box}>
                <mesh name='sphere1' position={[4, 0, 0]}>
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshStandardMaterial color="green" />
                </mesh>
            </Parented>
        </>
    )
}

function App() {
    return (
        <Editor scene={<Scene />} />
    )
}

const theme = createTheme({
    palette: {
        mode: 'dark',
    },
})

createRoot(document.getElementById('root')!).render(
    <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
    </ThemeProvider>,
)
