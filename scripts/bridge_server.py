from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
import requests
import datetime
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import os
import sys

try:
    from openf1_service import OpenF1Service
except ImportError:
    from scripts.openf1_service import OpenF1Service

app = FastAPI()
openf1 = OpenF1Service()

# Enable CORS for the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MissionRequest(BaseModel):
    year: str
    race_name: str
    laps: int = 5

# Create ingested directory
INGEST_DIR = "public/ingested"
os.makedirs(INGEST_DIR, exist_ok=True)

def clean_date(d_str: str) -> str:
    if not d_str: return ""
    return d_str.replace('Z', '').replace('+00:00', '').replace(' ', 'T')

class BackgroundIngestor:
    def __init__(self):
        self.sessions = {} # session_key -> { data: {tel, loc, weather}, status: str, progress: float }
        self.active_tasks = set()

    def get_session_data(self, session_key: int):
        if session_key not in self.sessions:
            self.sessions[session_key] = {
                "telemetry": [],
                "location": [],
                "weather": [],
                "last_ingested": None
            }
        return self.sessions[session_key]

    def ingest(self, session_key: int, start_date: str):
        if session_key in self.active_tasks:
            return
        self.active_tasks.add(session_key)
        
        try:
            print(f"\n[INGEST] >>> COMMAND INITIATED: Bulk download for session {session_key}")
            print(f"[INGEST] >>> TARGET START: {start_date}")
            session_data = self.get_session_data(session_key)
            
            # Start from the session start
            current_dt = datetime.datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            chunk_mins = 5
            max_chunks = 48 # 4 hours
            empty_count = 0
            
            total_tel = 0
            total_loc = 0
            
            start_ingest_time = time.time()

            for i in range(max_chunks):
                chunk_start_time = time.time()
                c_start = current_dt.strftime("%Y-%m-%dT%H:%M:%S")
                current_dt += datetime.timedelta(minutes=chunk_mins)
                c_end = current_dt.strftime("%Y-%m-%dT%H:%M:%S")
                
                # Fetch Telemetry
                t_resp = requests.get(f"{openf1.BASE_URL}/car_data", params={
                    "session_key": session_key, "date>": c_start, "date<": c_end
                }, timeout=15)
                new_tel = t_resp.json() if t_resp.status_code == 200 else []
                
                # Fetch Location
                l_resp = requests.get(f"{openf1.BASE_URL}/location", params={
                    "session_key": session_key, "date>": c_start, "date<": c_end
                }, timeout=15)
                new_loc = l_resp.json() if l_resp.status_code == 200 else []
                
                if not new_tel and not new_loc:
                    empty_count += 1
                    print(f"[INGEST] Chunk {i+1}: {c_start} -> {c_end} | EMPTY (Skip {empty_count}/3)")
                    if empty_count >= 3:
                        print(f"[INGEST] >>> TERMINAL: End of session data reached at {c_start}")
                        break
                else:
                    empty_count = 0
                    # Standardize & Normalize locations immediately
                    norm_count = 0
                    for loc in new_loc:
                        if loc.get('x') is not None:
                            nx, ny = openf1.normalize_point(session_key, loc['x'], loc['y'])
                            loc['x'], loc['y'] = nx, ny
                            norm_count += 1
                    
                    session_data["telemetry"].extend(new_tel)
                    session_data["location"].extend(new_loc)
                    session_data["last_ingested"] = c_end
                    
                    total_tel += len(new_tel)
                    total_loc += len(new_loc)
                    
                    chunk_duration = time.time() - chunk_start_time
                    print(f"[INGEST] Chunk {i+1}: {c_start} -> {c_end} | TEL: {len(new_tel)}, LOC: {len(new_loc)} (Norm: {norm_count}) | Dur: {chunk_duration:.2f}s")
                    print(f"[INGEST]   TOTAL SO FAR: TEL: {total_tel}, LOC: {total_loc}")
                
                # Yield to other tasks
                time.sleep(0.1)

            # Save to disk as a "Mission Profile" style fallback
            print(f"[INGEST] >>> WRITING TO DISK: session_{session_key}.json")
            save_path = os.path.join(INGEST_DIR, f"session_{session_key}.json")
            with open(save_path, 'w') as f:
                json.dump(session_data, f)
            
            file_size_kb = os.path.getsize(save_path) / 1024
            total_ingest_duration = time.time() - start_ingest_time
            print(f"[INGEST] >>> SUCCESS: Session {session_key} fully secured.")
            print(f"[INGEST]     Stats: {total_tel} Tel, {total_loc} Loc | Size: {file_size_kb:.2f} KB | Total Dur: {total_ingest_duration:.2f}s")

        except Exception as e:
            print(f"[INGEST] !!! ERROR for session {session_key}: {e}")
        finally:
            self.active_tasks.remove(session_key)

ingestor = BackgroundIngestor()
import time

@app.get("/openf1/test-data-availability")
async def test_data_availability():
    """
    Tests which sessions have telemetry data available across 2023-2024.
    Returns a list of sessions with data counts.
    """
    try:
        all_results = []
        
        for year in [2024, 2023]:
            print(f"\n[TEST] Checking {year} sessions...")
            sessions = openf1.get_sessions(year=year)
            
            # Test first 5 sessions per year
            for session in sessions[:5]:
                session_key = session['session_key']
                session_name = f"{session.get('location')} - {session.get('session_name')}"
                start_date = session.get('date_start', '').replace('Z', '').replace('+00:00', '')
                
                # Try to fetch a tiny sample
                try:
                    # Use a 1-minute window for the test sample
                    test_end = (datetime.datetime.fromisoformat(start_date.replace('Z', '+00:00')) + datetime.timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M:%S")
                    
                    tel_resp = requests.get(f"{openf1.BASE_URL}/car_data", params={
                        "session_key": session_key,
                        "date>": start_date,
                        "date<": test_end
                    }, timeout=10)
                    
                    loc_resp = requests.get(f"{openf1.BASE_URL}/location", params={
                        "session_key": session_key,
                        "date>": start_date,
                        "date<": test_end
                    }, timeout=10)
                    
                    tel_count = len(tel_resp.json()) if tel_resp.status_code == 200 and isinstance(tel_resp.json(), list) else 0
                    loc_count = len(loc_resp.json()) if loc_resp.status_code == 200 and isinstance(loc_resp.json(), list) else 0
                    
                    has_data = tel_count > 0 or loc_count > 0
                    
                    result = {
                        "session_key": session_key,
                        "year": year,
                        "name": session_name,
                        "date": session.get('date_start'),
                        "telemetry_count": tel_count,
                        "location_count": loc_count,
                        "has_data": has_data
                    }
                    
                    all_results.append(result)
                    print(f"[TEST] {session_name}: tel={tel_count}, loc={loc_count}, has_data={has_data}")
                    
                except Exception as e:
                    result = {
                        "session_key": session_key,
                        "year": year,
                        "name": session_name,
                        "has_data": False,
                        "error": str(e)[:100]
                    }
                    all_results.append(result)
                    print(f"[TEST] {session_name}: ERROR - {str(e)[:50]}")
        
        # Filter to only sessions with data
        sessions_with_data = [r for r in all_results if r.get('has_data')]
        
        return {
            "sessions_tested": len(all_results),
            "sessions_with_data": len(sessions_with_data),
            "all_sessions": all_results,
            "recommended": sessions_with_data[:3] if sessions_with_data else []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openf1/sessions")
async def get_openf1_sessions(year: int = 2024):
    try:
        return openf1.get_sessions(year=year)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openf1/provision")
async def provision_live_session(session_key: int = Query(...)):
    """
    One-stop shop to prepare a live race for the Command Center.
    Calculates bounds, fetches drivers, and builds track geometry.
    """
    try:
        session_info = openf1.get_session_info(session_key)
        start_date = session_info.get("date_start")
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        session_start = datetime.datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        is_historical = (now_utc - session_start).total_seconds() > 86400

        data = openf1.provision_session(session_key)
        data["is_historical"] = is_historical
        return data
    except Exception as e:
        print(f"[BRIDGE] Provisioning error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openf1/track")
async def get_openf1_track(session_key: int):
    try:
        # Get the first driver number to attribute the track points to
        drivers = openf1.get_drivers(session_key)
        if not drivers: return []
        d_num = drivers[0]['driver_number']
        
        raw_locations = openf1.get_track_layout(session_key)
        normalized = []
        for loc in raw_locations:
            nx, ny = openf1.normalize_point(session_key, loc['x'], loc['y'])
            normalized.append({
                "x": nx, 
                "y": ny, 
                "dist": loc.get('dist', 0),
                "driver_number": d_num, 
                "date": loc.get('date', "2000-01-01T00:00:00")
            })
        return normalized
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openf1/catchup")
async def get_openf1_catchup(session_key: int, background_tasks: BackgroundTasks):
    """
    Fetches the last 5 minutes of data across all streams.
    Smart logic: If the session is historical, fetch the FIRST 5 minutes instead.
    """
    try:
        session_info = openf1.get_session_info(session_key)
        start_date = session_info.get("date_start")
        
        # If session is > 24 hours old, treat as historical and fetch from start_date
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        session_start = datetime.datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        
        is_historical = (now_utc - session_start).total_seconds() > 86400
        
        if is_historical:
            # Trigger background ingestion
            background_tasks.add_task(ingestor.ingest, session_key, start_date)
            
            # For catchup, return what we have so far (usually some initial chunks)
            # Give it a tiny bit of time to get the first chunk if empty
            data = ingestor.get_session_data(session_key)
            if not data["telemetry"] and not data["location"]:
                time.sleep(1.0)
                data = ingestor.get_session_data(session_key)

            print(f"[BRIDGE] Serving historical catchup from ingestor buffer: {len(data['telemetry'])} points")
            
            return {
                "telemetry": data["telemetry"],
                "location": data["location"],
                "weather": [], # Weather can be added similarly if needed
                "is_historical": True,
                "ingest_progress": len(data["telemetry"])
            }
        else:
            # truly live
            five_min_ago = (now_utc - datetime.timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%S")
            raw_data = openf1.fetch_live_data(session_key, five_min_ago)
            # Normalize live locations
            for loc in raw_data.get('location', []):
                if loc.get('x') is not None:
                    nx, ny = openf1.normalize_point(session_key, loc['x'], loc['y'])
                    loc['x'], loc['y'] = nx, ny
            return raw_data
    except Exception as e:
        print(f"[BRIDGE] Catchup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openf1/live")
async def get_openf1_live(session_key: int, last_date: str = None):
    """
    Polls OpenF1 for new data.
    Smart logic: If no last_date and session is historical, start from session_start.
    """
    try:
        if not last_date:
             session_info = openf1.get_session_info(session_key)
             start_date = session_info.get("date_start")
             
             now_utc = datetime.datetime.now(datetime.timezone.utc)
             session_start = datetime.datetime.fromisoformat(start_date.replace('Z', '+00:00'))
             is_historical = (now_utc - session_start).total_seconds() > 86400

             if is_historical:
                 last_date = start_date.replace('Z', '').replace('+00:00', '')
             else:
                 last_date = (now_utc - datetime.timedelta(seconds=2)).strftime("%Y-%m-%dT%H:%M:%S")
             
        # 1. Fetch raw data
        # Check if historical based on the date_start of the session
        session_info = openf1.get_session_info(session_key)
        start_date_str = session_info.get("date_start")
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        session_start = datetime.datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
        is_historical = (now_utc - session_start).total_seconds() > 86400

        if is_historical:
            # Serve from ingestor buffer
            data = ingestor.get_session_data(session_key)
            # Find points in buffer where date > last_date
            tel_subset = [t for t in data["telemetry"] if t["date"] > last_date]
            loc_subset = [l for l in data["location"] if l["date"] > last_date]
            
            # To keep traffic sane, only return max 1000 points per poll
            if len(tel_subset) > 1000: tel_subset = tel_subset[:1000]
            if len(loc_subset) > 1000: loc_subset = loc_subset[:1000]

            return {
                "telemetry": tel_subset,
                "location": loc_subset,
                "weather": [],
                "buffer_size": len(data["telemetry"]),
                "is_ingesting": session_key in ingestor.active_tasks
            }
        else:
            # Truly live session
            raw_data = openf1.fetch_live_data(session_key, last_date)
            # Normalize live locations
            for loc in raw_data.get('location', []):
                if loc.get('x') is not None:
                    nx, ny = openf1.normalize_point(session_key, loc['x'], loc['y'])
                    loc['x'], loc['y'] = nx, ny
            return raw_data
        
    except Exception as e:
        print(f"[BRIDGE] Live fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add-mission")
async def add_mission(request: MissionRequest, background_tasks: BackgroundTasks):
    """
    Triggers the mission_control.py script in the background.
    """
    print(f"[BRIDGE] Request received for {request.year} {request.race_name}")
    background_tasks.add_task(run_script, request.year, request.race_name, str(request.laps))
    return {"status": "accepted", "message": f"Processing {request.race_name}..."}

def run_script(year, race_name, laps):
    try:
        cmd = ["python", "scripts/mission_control.py", "add", year, race_name, laps]
        process = subprocess.Popen(cmd, stdout=None, stderr=None)
        process.wait()
    except Exception as e:
        print(f"[BRIDGE] CRITICAL FAILURE: {e}")

@app.post("/delete-mission")
async def delete_mission_endpoint(request: dict):
    circuit_id = request.get("circuit_id")
    if not circuit_id:
        raise HTTPException(status_code=400, detail="circuit_id is required")
    run_delete_script(circuit_id)
    return {"status": "success", "message": f"Mission {circuit_id} decommissioned."}

def run_delete_script(circuit_id):
    try:
        cmd = ["python", "scripts/mission_control.py", "delete", circuit_id]
        process = subprocess.Popen(cmd, stdout=None, stderr=None)
        process.wait()
    except Exception as e:
        print(f"[BRIDGE] CRITICAL FAILURE: {e}")

if __name__ == "__main__":
    import uvicorn
    # Allow port override for testing/conflict resolution
    port = 3001
    for i, arg in enumerate(sys.argv):
        if arg == "--port" and i + 1 < len(sys.argv):
            port = int(sys.argv[i+1])
            break
            
    uvicorn.run(app, host="0.0.0.0", port=port)
