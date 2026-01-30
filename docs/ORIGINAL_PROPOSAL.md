# Minimalist F1 Race Analysis Interface

## 1. Project Overview

This project is a **single-screen, replay-first, minimalist Formula 1 race analysis interface** designed for data-driven F1 enthusiasts. It is not a broadcast replacement, not a telemetry dump, and not a storytelling UI. Instead, it is a **race decision-space visualizer** that allows users to understand *constraints, freedom, and decision quality* throughout a race.

The application prioritizes **clarity, determinism, and epistemic honesty** over spectacle.

---

## 2. Core Goals

- Replay historical F1 races with precise time control
- Visualize car movement, race evolution, and contextual data
- Preserve a calm, stable, non-scrollable UI
- Handle missing or incomplete data gracefully
- Support multiple data sources without coupling UI logic to any one API

---

## 3. Non-Goals (Explicitly Out of Scope)

- Live race broadcasting (initial phase)
- Raw team radio or audio/video playback
- Mobile-first or responsive UI
- Fantasy league, betting, or prediction features
- Full FIA-grade telemetry accuracy claims

---

## 4. High-Level Architecture

```
┌──────────────┐
│ External APIs│
└──────┬───────┘
       │
┌──────▼────────┐
│ Data Ingest & │
│ Normalization │
└──────┬────────┘
       │
┌──────▼────────┐n│ Race Engine   │  ← time → deterministic state
└──────┬────────┘
       │
┌──────▼────────┐
│ Track Engine  │  ← distance → coordinates
└──────┬────────┘
       │
┌──────▼────────┐
│ UI Renderer   │  ← dumb, engine-fed
└───────────────┘
```

---

## 5. Data Strategy (Multi-API by Design)

Different APIs are used for **different data responsibilities**. No single API is assumed to be complete or authoritative.

### 5.1 Race Metadata & Results

**Primary Option:** Ergast Developer API

- Seasons, races, circuits
- Drivers, constructors
- Final results
- Laps and pit stops (limited granularity)

Pros:
- Stable
- Free
- Well-documented

Cons:
- No true telemetry
- No spatial data

Use Case:
- Canonical race structure
- Driver and team identifiers

---

### 5.2 Timing & Lap-Level Data

**Primary Option:** FastF1 (Python)

- Lap times
- Sector times
- Tyre compound & stint data
- Session metadata

Pros:
- Rich historical depth
- Used by analysts

Cons:
- Python-only
- Requires preprocessing/export

Use Case:
- Core timing data
- Tyre and stint logic

---

### 5.3 Track Geometry

**Options:**

- FastF1 track data (where available)
- Manually curated SVG paths
- OpenStreetMap-based approximations (fallback)

Use Case:
- SVG track layout
- Normalized distance mapping

---

### 5.4 Weather Data (Optional / Later Phase)

**Options:**

- Open-Meteo API (historical)
- NOAA historical datasets

Use Case:
- Contextual constraints
- Overlay only (never dominant)

---

## 6. Data Normalization Layer

All external data is converted into a **canonical internal schema**.

### 6.1 Core Entities

- Race
- Track
- Driver
- Lap
- Event
- CarState

### 6.2 Example Schemas

#### Lap Data
```json
{
  "driver_id": "VER",
  "lap_number": 42,
  "lap_time": 74.567,
  "sector_1": 22.1,
  "sector_2": 31.2,
  "sector_3": 21.267,
  "compound": "SOFT",
  "is_pit_stop": false
}
```

#### CarState (Position & Telemetry)
```json
{
  "timestamp": 123456,
  "driver_id": "VER",
  "track_distance": 0.456, // 0 -> 1 normalized
  "speed": 284,
  "gear": 7,
  "throttle": 100,
  "brake": 0,
  "drs": true
}
```

---

### 6.3 Canonical Time Model

- Absolute time (milliseconds from race start)
- All sources converted into this scale
- No UI logic depends on raw API timestamps

### 6.4 Unknown Data Handling

All fields are explicitly one of:

- value
- unknown
- not_applicable

No silent nulls. No inferred backfilling by default.

---

## 7. Race Playback Engine

### Responsibilities

- Maintain a global time cursor
- Expose deterministic race state at any timestamp
- Support play, pause, scrub, and speed scaling

### Core API

- `setTime(t)`
- `play(speed)`
- `pause()`
- `getRaceStateAt(t)`

### Output Guarantees

- Deterministic
- Repeatable
- UI-agnostic

---

## 8. Track Engine

### Track Representation

- SVG path
- Resampled into N evenly spaced points
- Normalized length (0 → 1)

### Car Placement Logic

- Distance traveled → track position
- Linear interpolation only
- Events (pit entry/exit) snap

---

## 9. UI Design System

### Layout

Fixed, single-screen layout:

- Control strip (top)
- Track map (center)
- Data panel (right)
- Time scrubber (bottom)

No scrolling. No layout shifts.

---

### Interaction Grammar

| Action | Result |
|------|--------|
| Hover | Temporary highlight |
| Click | Lock focus |
| Drag time | Scrub race |
| ESC | Clear focus |

---

### Visual Rules

- Dark-only UI
- SVG-based rendering
- Muted team colors
- One accent color
- Motion only when time moves

---

## 10. Technology Stack

### Frontend

- **Framework:** React 18+ (Vite)
- **Language:** TypeScript
- **Visualization:** `Visx` (D3-powered React components) for charts and UI overlays.
- **Rendering:** SVG for track and cars (initially), shifting to `HTML5 Canvas / PixiJS` for performance scaling.
- **State:** `Zustand` for low-latency race cursor management.
- **Styling:** Vanilla CSS.

### Backend / Data Prep

- Python (FastF1 ingestion)
- Pandas for normalization
- JSON exports

---

## 11. Implementation Details: React + Visx Integration

The application uses **React** for the UI structure and **Visx** for high-performance, modular data visualizations.

### 11.1 Why Visx?
Visx provides a set of low-level visualization primitives (scales, shapes, axes) that are optimized for React. Unlike D3 alone, which manages its own DOM, Visx lets React handle the rendering, leading to a more consistent state management and better performance in a component-driven architecture.

### 11.2 Core Integration Pattern
- **Zustand Store:** Holds the `currentTime` and `telemetryData`.
- **Subscriber Components:** Individual components (Track, Speedometer, LapChart) subscribe to the store and update independently to minimize re-renders.
- **Visx Scales:** Used to map raw F1 data (e.g., speed: 0-350 km/h) to pixel coordinates.

---

## 21. Technology Alternatives & Scalability

As the project scales from a POC to a full race analysis tool, the initial stack can be optimized for better performance and developer experience.

### 21.1 Data Engine: DuckDB-Wasm
- **Recommendation:** Replace static JSON files with DuckDB-Wasm.
- **Reason:** Telemetry data is essentially a time-series database. DuckDB-Wasm allows running high-performance SQL queries directly in the browser. This enables instant filtering (e.g., "compare sector 2 of VER and HAM across laps 10-20") without loading massive JSON blobs.

### 21.2 Language & Type Safety: TypeScript
- **Recommendation:** Adopt TypeScript early.
- **Reason:** F1 data is highly structured but often messy. Type definitions for `Lap`, `CarState`, `TelemetryFrame`, and `RaceMetadata` prevent a whole class of runtime errors, especially when handling "unknown" or "missing" data points.

### 21.3 Rendering: PixiJS or HTML5 Canvas
- **Recommendation:** Move from SVG to a Canvas-based renderer (like PixiJS) for the track and telemetry.
- **Reason:** SVG has DOM overhead for every element. While 20 cars are fine, adding 20 "rings of freedom," tire wear indicators, and ghost cars for comparison will eventually lead to stuttering. Canvas handles thousands of objects at 60FPS effortlessly.

### 21.4 State Management: Zustand
- **Recommendation:** Use Zustand for the global "Race Cursor" state.
- **Reason:** You need a single source of truth for the current timestamp `t` that multiple components (Track, Data Panel, Scrubber) can subscribe to without unnecessary re-renders. Zustand is lightweight and extremely fast for high-frequency updates.

---

## 11. Constraint & Freedom Scaffolding (Future Layer)

UI affordances exist but remain neutral until logic is added:

- Rings around cars
- Opacity modulation
- Context bars in data panel

No inference without confidence.

---

## 15. Getting Started

### Prerequisites

-   **Node.js** (v18.0.0 or higher) - For frontend development and build tooling.
-   **Python** (v3.10 or higher) - For data ingestion and normalization scripts.
-   **FastF1** - Python library for F1 data access.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/f1-minimal-telemetry.git
    cd f1-minimal-telemetry
    ```

2.  **Setup Python environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts/activate
    pip install fastf1 pandas
    ```

3.  **Setup Frontend environment:**
    ```bash
    npm install
    ```

---

## 16. Development Guide

### Data Pipeline Flow

1.  **Ingest:** Run `scripts/ingest_race.py` to fetch raw data using FastF1.
2.  **Normalize:** The script produces a normalized JSON file in `public/data/`.
3.  **Render:** The frontend consumes these static JSON files for deterministic playback.

### Running Locally

-   **Frontend:** `npm run dev` to start the development server.
-   **Data Prep:** `python scripts/prep_track_data.py --year 2023 --race "Monaco"`

---

## 17. Project Roadmap

### Phase 1: Foundation (POC)
- [x] Technical Architecture Definition
- [x] Static Race Replay (Single Lap)
- [x] SVG Track Rendering Engine
- [x] Basic Time Scrubber

### Phase 2: Analysis Evolution (Alpha)
- [x] Multi-lap support
- [x] Tyre stint visualization
- [x] Pit stop event markers
- [x] Driver focus mode

### Phase 3: Sophistication (Beta)
- [ ] Delta-time overlays
- [ ] Live race simulation mode
- [ ] Advanced track geometry (elevation/width)

---

## 18. Validation Principles

-   Rapid scrubbing must never desync UI.
-   Unknown data must not break interaction.
-   Removing animation should not reduce usefulness.
-   At least 20% of features are expected to be cut.

---

## 19. Documentation & Honesty

The system explicitly documents:

-   Data gaps
-   Approximation limits
-   Inference boundaries

This is a feature, not a weakness.

---

## 20. Project Outcome

If executed correctly, this system becomes:

-   A strategist’s notebook
-   A race control-style analysis tool
-   A calm, truthful alternative to broadcast-driven race insights

Not louder. Not flashier. **Clearer.**
