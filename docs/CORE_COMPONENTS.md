# Core Components

This document details the primary React components and state management logic used in the F1 Minimal Telemetry frontend.

## TrackMap Component

The `TrackMap` is the centerpiece of the application. It renders a normalized SVG path of the circuit.

- **Responsiveness**: It calculates the aspect ratio of the track and scales the SVG to fit the parent container while maintaining geometry.
- **Car Layers**: Drivers are rendered as circles (or "cells") that move along the path based on their `normalizedDistance`.
- **Gap Visualization**: Specialized logic handles "gaps" in telemetry to ensure cars don't jump erratically across the map.

## Telemetry Visualizers

We use **Visx** for all charts to ensure they remain thin wrappers around SVG primitives.

- **Speedometer/G-Force**: High-frequency gauges that subscribe directly to the Zustand store.
- **Lap Comparison**: Multi-line charts for comparing sector times and delta times.

## State Management: The Race Store

The `useRaceStore` (Zustand) is the single source of truth for the race session.

### Key State Properties:
- `currentTime`: The global playback cursor in milliseconds.
- `playbackSpeed`: 1x, 2x, 5x, or 10x.
- `focusedDriver`: The ID of the driver currently selected for detailed telemetry.
- `telemetryData`: The full dataset loaded from the JSON catalog.

### Performance Tip:
To avoid re-rendering the entire app, components should subscribe to specific slices of state:
```typescript
const currentTime = useRaceStore((state) => state.currentTime);
```

## HUD Layers & Focus Modes

The interface uses a multi-layered HUD system that adapts to user interaction:

-   **Global Mode**: Shows the leaderboards, track status, and a `GlobalMultiGraph` for overall race trends.
-   **Focus Mode**: Triggered by clicking a driver. The UI dims global elements and activates:
    -   `IntegratedGauge`: A unified Speed/RPM/G-Force visualization.
    -   `SpeedDistanceGraph`: High-resolution telemetry for the specific driver.
    -   `Compass` & `VehicleStatus`: Real-time positional and health monitoring.

## Mobile Adaptation

On mobile screens, the HUD switches to a **Carousel System**:
-   `CarouselHUD`: A touch-friendly container that allows swiping between telemetry graphs and the `IntegratedGauge`.
-   `VerticalPlayback`: Playback controls pivot to a vertical side-pill to maximize screen real estate for the track map.

## Design Tokens

-   **Colors**: Custom HSL-based dark theme with high-contrast accents for telemetry (Throttle: Green, Brake: Red).
-   **Typography**: Data-dense font selection (Rajdhani for headers, JetBrains Mono for telemetry numbers).
-   **Animations**: Minimal but tactical. `framer-motion` is used exclusively for HUD transitions and Focus Vingettes to guide the user's attention without introducing "visual lag."
