# Setup Guide

Follow these instructions to set up your development environment for F1 Minimal Telemetry.

## System Requirements

- **Operating System**: Windows, macOS, or Linux.
- **Node.js**: v18.0.0 or higher.
- **Python**: v3.10 or higher.

## Step-by-Step Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/f1-minimal-telemetry.git
cd f1-minimal-telemetry
```

### 2. Frontend Setup
```bash
# Install NPM packages
npm install

# Build to verify (optional)
npm run build
```

### 3. Python Environment Setup
We recommend using a virtual environment.
```bash
# Create venv
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install fastf1 pandas
```

## Running the Project

The easiest way to run both the frontend and the data bridge is:

```bash
npm start
```

This uses `concurrently` to run:
- `npm run dev` (Vite dev server at localhost:5173)
- `npm run bridge` (Python bridge server)

## Project Structure

- `/src`: React components, hooks, and state.
- `/scripts`: Python data pipeline scripts.
- `/public/data`: Normalized JSON datasets (not git-ignored by default for portability).
- `/docs`: Technical documentation.

## Troubleshooting

- **CORS Errors**: Ensure the `bridge_server.py` is running if the frontend is attempting to fetch data dynamically.
- **Python Missing Dependencies**: Check if `fastf1` is installed correctly. Note that `fastf1` caches data in `~/.fastf1`, so its first run might be slow.
- **SVG Scaling Issues**: Ensure your browser zoom is at 100% for the most accurate track map rendering.
