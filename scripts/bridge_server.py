from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import os

app = FastAPI()

# Enable CORS for the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Vite port (e.g., http://localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MissionRequest(BaseModel):
    year: str
    race_name: str
    laps: int = 5

@app.post("/add-mission")
async def add_mission(request: MissionRequest, background_tasks: BackgroundTasks):
    """
    Triggers the mission_control.py script in the background.
    """
    print(f"[BRIDGE] Request received for {request.year} {request.race_name}")
    
    # We use BackgroundTasks so the HTTP response is immediate, 
    # but the process continues to run.
    background_tasks.add_task(
        run_script, 
        request.year, 
        request.race_name, 
        str(request.laps)
    )
    
    return {"status": "accepted", "message": f"Processing {request.race_name}..."}

def run_script(year, race_name, laps):
    try:
        # Execute the mission control script with real-time output
        cmd = ["python", "scripts/mission_control.py", "add", year, race_name, laps]
        print(f"[BRIDGE] Executing: {' '.join(cmd)}")
        
        # Use Popen to let output stream to the terminal naturally
        process = subprocess.Popen(
            cmd,
            stdout=None, # Inherit terminal stdout
            stderr=None  # Inherit terminal stderr
        )
        
        process.wait()
        
        if process.returncode == 0:
            print(f"[BRIDGE] SUCCESS: Captured stream completion for {race_name}.")
        else:
            print(f"[BRIDGE] ERROR: Script exited with code {process.returncode}")
            
    except Exception as e:
        print(f"[BRIDGE] CRITICAL FAILURE: {e}")

if __name__ == "__main__":
    import uvicorn
    # Run on port 3001
    uvicorn.run(app, host="0.0.0.0", port=3001)
