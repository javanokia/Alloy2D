# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-11-10

### 🚀 Highlights & Architectural Refinements
- **Rebranding to Alloy2D**: Officially renamed the engine to `alloy2d` (The Alloy of React & Pixi.js for Cross-Platform Mini-Games).
- **Independent Library Build**: Published as an ESM module (`dist/index.js`) with complete TypeScript definitions (`dist/index.d.ts`).
- **58 Unit Tests**: Comprehensive Vitest coverage across all modules (13 test suites, 100% passing).
- **Dual Complete Game Showcases**: Features two full-featured games: *Star Match3* (Tile Matching) and *Yang Sheep* (Card Stacking 3D).

### 🌟 New Features
- **AudioManager (`alloy2d/audio`)**:
  - Unified audio system with dual-backend support: `HTMLAudioElement` for Web/Desktop and `InnerAudioContext` for WeChat Mini-Game.
  - Sound effect registry with voice pooling (`voices`) and automatic fallback to WebAudio procedural synthesis.
  - BGM loop control, fade-in/fade-out transitions, and automatic pause/resume on lifecycle switches.
- **EffectManager (`alloy2d/effects`)**:
  - Low-GC particle explosion and floating text manager built on top of `Pool<T>`.
  - Configurable burst physics (gravity, velocity, scale, alpha fade curves).
- **InputManager (`alloy2d/input`)**:
  - Bidirectional coordinate transformation (`screenToDesign` / `designToScreen`) handling safe-area insets, DPR, and letterboxing.
  - Gesture recognition: Tap, Double Tap, Long Press, Swipe (with velocity & direction), and continuous Drag states.
- **SaveManager (`alloy2d/storage`)**:
  - Typed persistence with automated schema migrations (`migrations`).
  - Corrupted JSON fail-safe fallback to default factory values.
  - Storage driver abstraction (`DefaultPlatformSaveDriver` / `MemorySaveDriver`).
- **Canvas UI Kit (`alloy2d/ui`)**:
  - Native Pixi.js v7 UI widgets for DOM-less environments (WeChat Mini-Game):
    - `CanvasButton`: Pressed scaling (0.95x), sound integration, disabled state.
    - `CanvasPanel`: Rounded rectangular card container with dynamic resize.
    - `CanvasModal`: Fullscreen backdrop, spring entrance animation (`easeOutBack`), and close handlers.
- **Universal WeChat Launcher (`bootstrapWxGame` / `runWxGame`)**:
  - Declarative bootstrap handling canvas attachment, asset loading, WebGL context loss/recovery, and main ticker loop.

---

## [1.0.0] - 2026-11-09

### Initial Release
- Initial hybrid engine architecture pairing React 18 with Pixi.js v7.
- Core systems: `SceneManager`, `DirtyStateSync`, `EventBus`, and `screenResize`.
- Multi-platform adapter layer for Web, WeChat Mini-Game, and Electron desktop.
- `Pool<T>` object pool and `tweenManager` lightweight animation utilities.
- React host components: `HybridCanvasHost`, `ModalDialog`, and `EngineInspectorDock`.
