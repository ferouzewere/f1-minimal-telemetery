# ⚙️ Data Pipeline

The project uses a Python-based pipeline to ingest, clean, and optimize F1 telemetry for web consumption.

## 🏃 Workflow

1.  **Fetch**: Raw telemetry, lap data, and weather info are pulled from `FastF1`.
2.  **Ingest & Normalize**: GPS coordinates are shifted and scaled; telemetry is synced with position data.
3.  **Optimize**: Data is downsampled where possible to reduce JSON size while preserving strategic fidelity.
4.  **Catalog**: The `sessions.json` file is updated with new session metadata and SVG path thumbnails.

## 📜 Key Scripts

| Script | Purpose |
| :--- | :--- |
| `fetch_circuit.py` | Basic ingestion: Fetches track geometry and limited driver telemetry. |
| `add_historical_race_full.py` | Advanced ingestion: Full session data including weather, track status, and complete grids. |
| `fetch_multi_driver.py` | Targeted fetch for specific driver comparisons. |
| `bridge_server.py` | Local Python server for dynamic data serving or live status polling. |
| `mission_control.py` | Management utility for cleaning and monitoring the session catalog. |

## 🛠️ Ingesting a New Race

To add a new race to the local library:

```bash
# Example: Adding Silverstone 2024
python scripts/add_historical_race_full.py --year 2024 --event "British Grand Prix"
```

## 📊 Data Schema

The normalized JSON output follows this structure:

```json
{
  "drivers": ["VER", "HAM", "NOR"],
  "track": {
    "points": [{"x": 0.1, "y": 0.2, "dist": 0.0}, ...],
    "sectors": [0.33, 0.66, 1.0]
  },
  "telemetry": {
    "VER": [
      {"t": 0, "v": 0, "g": 1},
      {"t": 100, "v": 150, "g": 4}
    ]
  }
}
```
