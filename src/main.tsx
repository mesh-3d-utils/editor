import { createRoot } from 'react-dom/client'
import { Editor } from './editor.js'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

function Scene() {
    return (
        <>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />

            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial color="royalblue" />
            </mesh>

            
            <mesh position={[4, 0, 0]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial color="hotpink" />
            </mesh>
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
