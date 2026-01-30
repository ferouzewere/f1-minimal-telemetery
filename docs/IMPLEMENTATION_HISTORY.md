# 📜 Implementation History

This document serves as a permanent log of the technical milestones achieved in the F1 Minimal Telemetry project, moving from the initial proposal to the current high-density analysis interface.

---

## 🏁 Phase 1: Foundation (The POC)
**Goal:** Establish the deterministic coordinate system and basic playback engine.

- [x] **Project Scaffolding**: Setup Vite + React + TypeScript + Zustand.
- [x] **FastF1 Ingestion Pipeline**: Created Python scripts to interface with official F1 telemetry feeds.
- [x] **Coordinate Normalization**: Implemented the coordinate shift/scale logic to map raw GPS data into a standardized 1000x700 SVG viewport.
- [x] **The Race Store**: Established the Zustand store as the single source of truth for `currentTime` and `playSpeed`.
- [x] **SVG Track Engine**: Built the initial `TrackMap` component with responsive path scaling.

---

## 🧠 Phase 2: Analysis & HUD (Current State)
**Goal:** Transition from a simple replay to a professional-grade analysis tool.

- [x] **Adaptive HUD Layers**: Implemented a responsive multi-layered HUD that separates "Ambient Map" from "Interactive Overlays."
- [x] **Driver Focus Mode**:
    - Developed the "Vignette" and "Dimming" system to prioritize the active driver.
    - Implemented focus-specific HUD transitions using `framer-motion`.
- [x] **Tyre Stint Visualization**:
    - **Backend**: Enhanced scripts to group laps by compound and stint number.
    - **Frontend**: Created the `StintTimeline` component with FIA-spec compound coloring.
- [x] **High-Density Telemetry**:
    - Integrated **Visx** for SVG-based charts (`SpeedDistanceGraph`, `GlobalMultiGraph`).
    - Developed the `IntegratedGauge` (Speed/RPM/G-Force) for focused telemetry tracking.
- [x] **Mobile Adaptation**:
    - Built the **Carousel HUD** for touch devices.
    - Implemented a **Vertical Playback Pill** to optimize track map real estate on portrait screens.
- [x] **Environment Systems**: Added `WeatherOverlay` and `TrackStatusBanner` to handle session-level variable monitoring.

---

## 🚀 Phase 3: Sophistication (In Progress)
**Goal:** Deep analysis and multi-source synchronization.

- [/] **Bridge Server Architecture**: Established `bridge_server.py` for dynamic data serving and live state polling.
- [/] **Historical Comparisons**: Implemented the foundation for `comparisonDriver` logic in the store.
- [ ] **Delta-Time Overlays**: (Planned) Live gap tracking between drivers on the track map.
- [ ] **Data Optimization**: (Planned) DuckDB-Wasm integration for instant client-side SQL analysis.

---

## 🛠️ Technical Transitions
| Original Concept | Final Implementation | Rationale |
| :--- | :--- | :--- |
| Vanilla JS / Preact | React 19 + TypeScript | Scalability and type safety for complex telemetry frames. |
| Anime.js | Framer Motion | Declarative HUD transitions and better integration with Reach lifecycle. |
| Manual SVG paths | Python Auto-Generation | Deterministic mapping of actual GPS coordinates to SVG paths. |
| Static JSON | IndexedDB Caching | Faster subsequent loads and reduced server overhead. |
