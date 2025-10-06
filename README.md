# @manifold/editor

3D editor for React Three Fiber.

## Components

### `Editor`

Main canvas component for rendering 3D game scenes.

```typescript
import { Canvas } from '@react-three/fiber'
import { Editor } from '@manifold/editor';

function App() {
  return (
    <Canvas>
      {/* Your 3D game components */}
      <Editor />
    </Canvas>
  );
}
```

## Building

```bash
# Build ESM + CJS + type declarations
pnpm build

# Watch mode
pnpm dev

# Clean build artifacts
pnpm clean
```

Output is generated in `dist/` with:
- `dist/index.js` (CommonJS)
- `dist/index.mjs` (ES Module)
- `dist/index.d.ts` (TypeScript declarations)

## Usage

Install as a workspace dependency:

```json
{
  "dependencies": {
    "@manifold/editor": "workspace:*"
  }
}
```

Import in your React app:

```typescript
import { ManifoldCanvas } from '@manifold/editor';
```

## TypeScript Configuration

This package uses:
- **Base config**: `@code-essentials/tsconfig/tsconfig.json`
- **Composite**: `true` (for project references)
- **JSX**: `react-jsx`
- **Output**: `dist/` (managed by `tsup`)

## Dependencies

- **@manifold/core**: Core game engine types.
- **three**: Three.js 3D library.
- **@react-three/fiber**: React renderer for Three.js.
- **@react-three/drei**: Useful helpers for React Three Fiber.

## Development

- Add new 3D components in `src/`.
- Export public APIs via `src/index.ts`.
- Run `pnpm build` to generate type declarations.

## License

MIT

## Development Server

To run the development server with a live demo:

```bash
# From the editor package directory
pnpm dev

# Or from the monorepo root
pnpm editor
```

This will start a Vite development server at `http://localhost:3001` with hot module replacement.

### Demo Features

The demo includes:
- Interactive 3D editor with select and transform tools
- Vertex editing mode with draggable vertex points
- Click-to-select objects and vertices
- Visual feedback for selections
- Camera controls (orbit, zoom, pan)

### Controls

- **Select Tool**: Click objects or vertices to select them
- **Transform Tool**: Use gizmos to move/rotate/scale selected objects
- **Vertex Mode**: Click green vertex points to select them, then use transform gizmo
- **Shift+Click**: Add to selection (multi-select)
- **Background Click**: Clear selection
