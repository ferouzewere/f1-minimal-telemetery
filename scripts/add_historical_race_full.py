"""
Advanced Race Adder
Fetches high-fidelity F1 data, normalizes it, and updates the sessions manifest.
"""

import fastf1
import pandas as pd
import json
import os
import sys

# Constants
NORM_WIDTH = 1000
NORM_HEIGHT = 700
NORM_PADDING = 50

# Enable Cache
os.makedirs('cache', exist_ok=True)
fastf1.Cache.enable_cache('cache')

def fetch_and_add_race(year, race_name, lap_count=5):
    print(f"\n>>> DYNAMIC INGESTION: {year} {race_name} GP")
    
    try:
        session = fastf1.get_session(year, race_name, 'R')
        session.load(telemetry=True, laps=True, weather=True)
    except Exception as e:
        print(f"FAILED TO LOAD SESSION: {e}")
        return

    # 1. Fetch Weather Data
    weather_data = []
    try:
        weather = session.weather_data
        for _, row in weather.iterrows():
            weather_data.append({
                't': int(row['Time'].total_seconds() * 1000),
                'air_temp': float(row['AirTemp']),
                'track_temp': float(row['TrackTemp']),
                'humidity': float(row['Humidity']),
                'rainfall': bool(row['Rainfall']),
                'wind_speed': float(row['WindSpeed']),
                'wind_direction': int(row['WindDirection'])
            })
    except Exception as e:
        print(f"  ⚠️ Weather fetch failed: {e}")

    # 2. Fetch Track Status
    track_status_data = []
    try:
        ts = session.track_status
        for _, row in ts.iterrows():
            track_status_data.append({
                't': int(row['Time'].total_seconds() * 1000),
                'status': str(row['Status']),
                'message': str(row['Message']) if 'Message' in row else ""
            })
    except Exception as e:
        print(f"  ⚠️ Track status fetch failed: {e}")

    # 3. Process Drivers
    all_driver_abbrs = list(session.results['Abbreviation'].unique())
    all_drivers_data = []
    
    valid_abbrs = list(session.results['Abbreviation'].unique())
    ref_driver = valid_abbrs[0]
    
    # Track Metadata
    first_driver_laps = session.laps.pick_drivers([ref_driver])
    first_lap_tel = first_driver_laps.iloc[0].get_telemetry()
    lap_length = int(first_lap_tel['Distance'].max())
    
    # Sectors
    s1_end = int(lap_length * 0.28)
    s2_end = int(lap_length * 0.68)
    
    for driver_abbr in all_driver_abbrs:
        print(f"  Processing {driver_abbr}...")
        driver_laps = session.laps.pick_drivers([driver_abbr])
        if driver_laps.empty: continue
            
        res = session.results[session.results['Abbreviation'] == driver_abbr]
        driver_name = f"{res.iloc[0]['FirstName']} {res.iloc[0]['LastName']}" if not res.empty else driver_abbr
        team = res.iloc[0]['TeamName'] if not res.empty else "Unknown"
        color = res.iloc[0]['TeamColor'] if not res.empty else "FFFFFF"

        stints = []
        for stint_num, stint_laps in driver_laps.groupby('Stint'):
            stints.append({
                'compound': str(stint_laps['Compound'].iloc[0]),
                'stint': int(stint_num),
                'start_lap': int(stint_laps['LapNumber'].iloc[0]),
                'count': len(stint_laps)
            })

        sample_laps = driver_laps.iloc[0:lap_count]
        telemetry_data = []
        total_dist_so_far = 0
        
        for _, lap in sample_laps.iterrows():
            try:
                tel = lap.get_telemetry()
                pos = lap.get_pos_data()
                is_pit = pd.notna(lap['PitInTime']) or pd.notna(lap['PitOutTime'])
                
                prev_speed = 0
                prev_t = 0
                
                for idx, row in tel.iterrows():
                    curr_t = int(row['Time'].total_seconds() * 1000)
                    curr_speed = int(row['Speed'])
                    
                    # Longitudinal acceleration calculation (roughly Gs)
                    ax = 0
                    if curr_t > prev_t:
                        ax = (curr_speed - prev_speed) / ((curr_t - prev_t) / 1000.0) * 0.0283
                    
                    new_pt = {
                        't': curr_t,
                        'lap': int(lap['LapNumber']),
                        'dist': float(row['Distance']) + total_dist_so_far,
                        'speed': curr_speed,
                        'rpm': int(row['RPM']) if 'RPM' in row else 0,
                        'gear': int(row['nGear']),
                        'throttle': int(row['Throttle']),
                        'brake': int(row['Brake']),
                        'drs': int(row['DRS']) if 'DRS' in row else 0,
                        'ax': ax
                    }
                    
                    time_diffs = (pos['Time'] - row['Time']).abs()
                    c_idx = time_diffs.idxmin() if not pos.empty else None
                    if c_idx is not None:
                        p_row = pos.loc[c_idx]
                        new_pt['x'] = float(p_row['X'])
                        new_pt['y'] = float(p_row['Y'])
                    
                    new_pt['compound'] = str(lap['Compound'])
                    new_pt['tyre_age'] = int(lap['TyreLife'])
                    new_pt['is_pit'] = is_pit
                    telemetry_data.append(new_pt)
                    
                    prev_speed = curr_speed
                    prev_t = curr_t
                
                total_dist_so_far += tel['Distance'].max()
            except: continue

        all_drivers_data.append({
            'driver_abbr': driver_abbr,
            'driver_name': driver_name,
            'team': team,
            'team_color': f"#{color}",
            'stints': stints,
            'telemetry': telemetry_data
        })

    # 4. Normalize
    all_xs = [p['x'] for d in all_drivers_data for p in d['telemetry'] if 'x' in p]
    all_ys = [p['y'] for d in all_drivers_data for p in d['telemetry'] if 'y' in p]
    
    if all_xs and all_ys:
        min_x, max_x = min(all_xs), max(all_xs)
        min_y, max_y = min(all_ys), max(all_ys)
        xr, yr = max_x - min_x, max_y - min_y
        scale = min((NORM_WIDTH - 2*NORM_PADDING)/xr, (NORM_HEIGHT - 2*NORM_PADDING)/yr)
        ox = (NORM_WIDTH - xr*scale)/2
        oy = (NORM_HEIGHT - yr*scale)/2
        
        for d in all_drivers_data:
            for p in d['telemetry']:
                if 'x' in p:
                    p['x'] = (p['x'] - min_x) * scale + ox
                    p['y'] = (p['y'] - min_y) * scale + oy

    race_data = {
        'race_name': f"{year} {race_name} GP (Intelligence Data)",
        'year': year,
        'circuit': race_name,
        'weather': weather_data,
        'track_status': track_status_data,
        'drivers': all_drivers_data
    }

    # 5. Save JSON
    safe_name = race_name.replace(' ', '_')
    data_filename = f"public/data/{year}_{safe_name}_intelligence.json"
    with open(data_filename, 'w') as f:
        json.dump(race_data, f, separators=(',', ':'))

    # 6. Update sessions.json
    try:
        with open('public/sessions.json', 'r') as f:
            manifest = json.load(f)
        
        # 6.1 Generate SVG Path (Thumbnail)
        import math
        svg_path = ""
        if all_drivers_data:
            ref_tel = all_drivers_data[0]['telemetry']
            # Get first lap points only
            first_lap = [p for p in ref_tel if p['lap'] == ref_tel[0]['lap']]
            if len(first_lap) > 10:
                # Subsample slightly first to clean jitters
                step = max(1, len(first_lap) // 1500)
                sampled = first_lap[::step]
                
                # --- DYNAMIC SMOOTHING (Catmull-Rom) ---
                smoothed_points = []
                n = len(sampled)
                # Check if it's a closed loop
                is_closed = math.hypot(sampled[0]['x']-sampled[-1]['x'], sampled[0]['y']-sampled[-1]['y']) < 50
                
                for i in range(n):
                    p0 = sampled[(i - 1) % n] if is_closed else sampled[max(0, i-1)]
                    p1 = sampled[i]
                    p2 = sampled[(i + 1) % n] if is_closed else sampled[min(n-1, i+1)]
                    p3 = sampled[(i + 2) % n] if is_closed else sampled[min(n-1, i+2)]
                    
                    for t_idx in range(4): # 4 interpolation points per segment
                        t = t_idx / 4
                        t2, t3 = t*t, t*t*t
                        f1 = -0.5*t3 + t2 - 0.5*t
                        f2 =  1.5*t3 - 2.5*t2 + 1.0
                        f3 = -1.5*t3 + 2.0*t2 + 0.5*t
                        f4 =  0.5*t3 - 0.5*t2
                        
                        sx = p0['x']*f1 + p1['x']*f2 + p2['x']*f3 + p3['x']*f4
                        sy = p0['y']*f1 + p1['y']*f2 + p2['y']*f3 + p3['y']*f4
                        
                        cmd = "M" if i == 0 and t_idx == 0 else "L"
                        smoothed_points.append(f"{cmd}{sx:.3f} {sy:.3f}")
                
                svg_path = "".join(smoothed_points)
                if is_closed: svg_path += "Z"

        # 6.2 Extract Race Metadata for Manifest
        metadata = {}
        try:
            # Winner Info
            if not session.results.empty:
                winner = session.results.iloc[0]
                metadata['winner'] = {
                    'name': f"{winner['FirstName']} {winner['LastName']}",
                    'team': winner['TeamName'],
                    'color': f"#{winner['TeamColor']}"
                }
            
            # Weather Summary
            if not session.weather_data.empty:
                avg_air = session.weather_data['AirTemp'].mean()
                was_rain = session.weather_data['Rainfall'].any()
                metadata['weather'] = {
                    'temp': round(float(avg_air), 1),
                    'condition': 'Rainy' if was_rain else 'Dry'
                }
        except Exception as e:
            print(f"  ⚠️ Metadata extraction partially failed: {e}")

        circuit_id = f"{year}-{safe_name.lower()}"
        session_entry = {
            "id": f"{circuit_id}-intel",
            "name": f"{year} Race (Intelligence Data)",
            "description": f"High-fidelity telemetry, weather and track status for {race_name}.",
            "file": f"/data/{year}_{safe_name}_intelligence.json",
            "metadata": metadata
        }

        # Find or Create Circuit
        found_circuit = None
        clean_target_name = f"{race_name} Grand Prix"
        for c in manifest['circuits']:
            if c['id'] == circuit_id or c['name'].lower() == clean_target_name.lower():
                found_circuit = c
                break
        
        if found_circuit:
            # Update path if we generated one
            if svg_path:
                found_circuit['track_path'] = svg_path
            
            # Check if session exists, if so update/replace, if not add
            existing_session_idx = next((i for i, s in enumerate(found_circuit['sessions']) if s['id'] == session_entry['id']), None)
            if existing_session_idx is not None:
                found_circuit['sessions'][existing_session_idx] = session_entry
            else:
                found_circuit['sessions'].insert(0, session_entry)
            
            # Ensure name is clean
            if "Grand Prix Grand Prix" in found_circuit['name']:
                found_circuit['name'] = clean_target_name
        else:
            # Create new circuit block
            new_circuit = {
                "id": circuit_id,
                "name": clean_target_name,
                "location": f"{race_name}",
                "lapLength": lap_length,
                "track_path": svg_path,
                "sectors": {"s1_end": s1_end, "s2_end": s2_end},
                "sessions": [session_entry]
            }
            manifest['circuits'].append(new_circuit)

        with open('public/sessions.json', 'w') as f:
            json.dump(manifest, f, indent=4)
        
        print(f"\n✅ SUCCESS: Added {year} {race_name} GP to Command Center!")
        print(f"[MISSION_MARKER] COMPLETE: {circuit_id}")
    except Exception as e:
        print(f"❌ Failed to update manifest: {e}")

if __name__ == "__main__":
    y = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    r = sys.argv[2] if len(sys.argv) > 2 else 'Silverstone'
    l = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    fetch_and_add_race(y, r, l)
