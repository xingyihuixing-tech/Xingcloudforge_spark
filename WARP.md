# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a React + Three.js visualization application featuring:
- **Nebula Mode (NebulaScene)**: Generates particle point clouds from images with dynamic effects
- **Planet Mode (PlanetScene)**: Renders planet systems; in Interop Mode it takes over nebula instance rendering and syncs uniforms
- **Control Panel**: Unified UI for editing global settings and nebula instance parameters

The project is written in Chinese/English mixed documentation. The application uses Vite for development/build and Vercel for deployment.

## Commands

```bash
# Install dependencies
npm install

# Start development server (HTTPS on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Generate texture files (auto-runs before dev/build)
npm run generate

# Storybook development
npm run storybook

# Build Storybook
npm run build-storybook
```

## Key Architecture

### Authority Sources (Single Source of Truth)

- **`types.ts`**: All TypeScript types (`AppSettings`, `NebulaInstance`, `PlanetSettings`, etc.)
- **`constants.ts`**: All default values and presets (`DEFAULT_SETTINGS`, `DEFAULT_NEBULA_INSTANCE`, etc.)
- **`App.tsx`**: Root component handling state management, mode switching, and parameter flow

### Core Rendering Pipeline

```
App.tsx (state management)
    ├── NebulaScene.tsx (nebula particle rendering)
    ├── PlanetScene.tsx (planet + interop mode rendering)
    └── ControlPanel.tsx (UI → state updates → uniform sync)
```

### Directory Structure

- **`components/`**: UI and rendering components (NebulaScene, PlanetScene, ControlPanel, MagicCircleDrawing)
- **`shaders/`**: GLSL shaders for particle effects (vertex/fragment shaders as TypeScript strings)
- **`utils/`**: Non-UI utilities (drawingSystem, storage, normalization, material styles)
- **`services/`**: Image processing, line computation, light flow paths
- **`api/`**: Vercel serverless functions (auth, config, upload, AI endpoints)
- **`contexts/`**: React contexts (UserContext for auth/config sync)
- **`hooks/`**: Custom React hooks

### Shader System

Shaders are defined in `shaders/nebulaShaders.ts` and `shaders/nebulaCanvasShaders.ts` as template strings. Key uniforms:
- `uOverlayMode`: Interop mode color compensation (0..1 intensity)
- Effect uniforms for flicker, wave, lightning, breathing, etc.

### Magic Circle Drawing System

Located in `components/MagicCircleDrawing/`:
- Three brush types: particle, silk ring (lineRing), lightsaber
- Supports symmetry modes: radial, kaleidoscope, starburst, sphere (all with fractal support)
- Pressure sensitivity modes: none, calligraphy, brightness
- Brush parameters use existing `ParticleRingSettings` and `SilkRingSettings` types

### Instance-Level Effects (Scheme A)

Effects are saved per-instance in `NebulaInstance`:
- Flicker, wave, wandering lightning, lightning breakdown
- Render layer reads instance fields first, falls back to global `AppSettings`
- Control panel requires selecting an instance to edit these effects

### API Architecture (Dual Key Routing)

| Model Group | Env Variable | Models |
|-------------|--------------|--------|
| Claude | `JIMIAI_API_KEY_CLAUDE` | opus, sonnet, sonnet-thinking, haiku |
| Gemini Chat | `JIMIAI_API_KEY_GEMINI` | gemini-3-flash-preview, gemini-3-pro-preview |
| Xuai (Image) | `IMAGE_API_KEY` | gemini-3-pro-image-preview |

### Data Versioning

`App.tsx` defines `DATA_VERSION` (currently 73). Incrementing this clears localStorage on startup to handle schema changes.

## Environment Variables

For local development, copy `.env.example` to `.env.local`:
```
VITE_GEMINI_API_KEY=your_key
CHAT_PROXY_BASE_URL=jimiai_proxy_url
IMAGE_PROXY_BASE_URL=xuai_proxy_url
JIMIAI_API_KEY_CLAUDE=claude_key
JIMIAI_API_KEY_GEMINI=gemini_key
IMAGE_API_KEY=xuai_key
```

## Conventions

### File Header Comments

Each source file should include a header comment describing:
- **input**: What data/parameters flow in
- **output**: What the file produces/exports
- **pos**: Its role in the architecture
- **update**: Reminder to update README files when modified

### README Maintenance

Each directory contains `_README.md` or `README.md` that must be updated when files change. The files themselves remind: "一旦我所属的文件夹有所变化，请更新我。"

### Naming Conventions

- Lightsaber brush uniforms use `uMC*` prefix for magic circle-level parameters
- Instance effect fields mirror global settings but are stored per-instance
- Custom magic circle strokes directly reuse `ParticleRingSettings` and `SilkRingSettings`
