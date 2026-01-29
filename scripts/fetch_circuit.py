"""
Unified Fetcher & Optimizer for new Circuits
Fetches a race session, optimizes it, and prints the manifest entry.
"""

import fastf1
import pandas as pd
import json
import os
import sys
import numpy as np

# Normalization Constants
NORM_WIDTH = 1000
NORM_HEIGHT = 700
NORM_PADDING = 50

# Enable Cache
os.makedirs('cache', exist_ok=True)
fastf1.Cache.enable_cache('cache')

def fetch_circuit(year, race_name, lap_count=5, drivers_to_fetch=None):
    print(f"\n>>> FETCHING: {year} {race_name} GP (Laps 1-{lap_count})")
    
    try:
        session = fastf1.get_session(year, race_name, 'R')
        session.load(telemetry=True, laps=True, weather=False)
    except Exception as e:
        print(f"FAILED TO LOAD SESSION: {e}")
        return None

    # Get all race laps
    laps = session.laps
    if drivers_to_fetch:
        all_driver_abbrs = drivers_to_fetch
    else:
        all_driver_abbrs = list(session.results['Abbreviation'].unique())
    
    all_drivers_data = []
    
    # Calculate track length from first driver, first lap
    # Use existing results to find a valid driver if specific ones not found
    valid_abbrs = list(session.results['Abbreviation'].unique())
    ref_driver = all_driver_abbrs[0] if all_driver_abbrs[0] in valid_abbrs else valid_abbrs[0]
    
    first_driver_laps = laps.pick_drivers([ref_driver])
    first_lap_tel = first_driver_laps.iloc[0].get_telemetry()
    lap_length = int(first_lap_tel['Distance'].max())
    
    # Estimate Sectors (F1 usually does roughly even thirds if data not available)
    s1_end = int(lap_length * 0.25)
    s2_end = int(lap_length * 0.65)
    
    for driver_abbr in all_driver_abbrs:
        if driver_abbr not in valid_abbrs:
            print(f"  ⚠️ Skipping {driver_abbr} (not in session results)")
            continue
        print(f"  Processing {driver_abbr}...")
        driver_laps = laps.pick_drivers([driver_abbr])
        if driver_laps.empty: continue
            
        # Result info
        res = session.results[session.results['Abbreviation'] == driver_abbr]
        driver_name = f"{res.iloc[0]['FirstName']} {res.iloc[0]['LastName']}" if not res.empty else driver_abbr
        team = res.iloc[0]['TeamName'] if not res.empty else "Unknown"

        # Tyre Stints
        stints = []
        for stint_num, stint_laps in driver_laps.groupby('Stint'):
            stints.append({
                'compound': str(stint_laps['Compound'].iloc[0]),
                'stint': int(stint_num),
                'start_lap': int(stint_laps['LapNumber'].iloc[0]),
                'count': len(stint_laps)
            })

        # Telemetry (Limited laps for speed/size)
        sample_laps = driver_laps.iloc[0:lap_count]
        telemetry_data = []
        total_dist_so_far = 0
        
        for _, lap in sample_laps.iterrows():
            try:
                # Fetch telemetry and position
                tel = lap.get_telemetry()
                pos = lap.get_pos_data()
                
                # Check for pit
                is_pit = pd.notna(lap['PitInTime']) or pd.notna(lap['PitOutTime'])
                
                lap_points = 0
                prev_speed = 0
                prev_t = 0
                
                for idx, row in tel.iterrows():
                    curr_t = int(row['Time'].total_seconds() * 1000)
                    curr_speed = int(row['Speed'])
                    
                    # Simple longitudinal acceleration (km/h per second, then normalized roughly to Gs)
                    # 1 km/h/s = 0.277 / 9.81 Gs
                    ax = 0
                    if curr_t > prev_t:
                        ax = (curr_speed - prev_speed) / ((curr_t - prev_t) / 1000.0) * 0.0283
                    
                    # Optimized: Rounding and filtering
                    new_pt = {
                        't': curr_t,
                        'lap': int(lap['LapNumber']),
                        'dist': round(float(row['Distance']) + total_dist_so_far, 1),
                        'speed': curr_speed,
                        'gear': int(row['nGear']),
                        'throttle': int(row['Throttle']),
                        'brake': int(row['Brake']),
                        'ax': round(ax, 2),
                        'ay': 0 # Lateral needs more math
                    }
                    
                    # Add X/Y with low precision
                    time_diffs = (pos['Time'] - row['Time']).abs()
                    c_idx = time_diffs.idxmin() if not pos.empty else None
                    if c_idx is not None:
                        p_row = pos.loc[c_idx]
                        new_pt['x'] = float(p_row['X'])
                        new_pt['y'] = float(p_row['Y'])
                    else:
                        new_pt['x'] = 0
                        new_pt['y'] = 0
                    
                    new_pt['compound'] = str(lap['Compound'])
                    new_pt['tyre_age'] = int(lap['TyreLife'])
                    new_pt['is_pit'] = is_pit
                    
                    telemetry_data.append(new_pt)
                    lap_points += 1
                    prev_speed = curr_speed
                    prev_t = curr_t
                
                if len(tel) > 0:
                    total_dist_so_far += tel['Distance'].max()
                print(f"    Added {lap_points} points for {driver_abbr} lap {lap['LapNumber']}")
            except Exception as e: 
                print(f"    Error processing lap for {driver_abbr}: {e}")
                continue

        print(f"  Total points for {driver_abbr}: {len(telemetry_data)}")
        all_drivers_data.append({
            'driver_abbr': driver_abbr,
            'driver_name': driver_name,
            'team': team,
            'stints': stints,
            'telemetry': telemetry_data
        })

    race_data = {
        'race_name': f"{year} {race_name} GP",
        'year': year,
        'circuit': race_name,
        'drivers': all_drivers_data
    }
    
    # Normalize Tracks to Standard Viewport (1000x700)
    all_xs = [p['x'] for d in all_drivers_data for p in d['telemetry']]
    all_ys = [p['y'] for d in all_drivers_data for p in d['telemetry']]
    
    if all_xs and all_ys:
        min_x, max_x = min(all_xs), max(all_xs)
        min_y, max_y = min(all_ys), max(all_ys)
        xr, yr = max_x - min_x, max_y - min_y
        scale = min((NORM_WIDTH - 2*NORM_PADDING)/xr, (NORM_HEIGHT - 2*NORM_PADDING)/yr)
        ox = (NORM_WIDTH - xr*scale)/2
        oy = (NORM_HEIGHT - yr*scale)/2
        
        for d in all_drivers_data:
            for p in d['telemetry']:
                p['x'] = (p['x'] - min_x) * scale + ox
                p['y'] = (p['y'] - min_y) * scale + oy

    # Save
    safe_name = race_name.replace(' ', '_')
    filename = f"public/data/{year}_{safe_name}_sample.json"
    with open(filename, 'w') as f:
        json.dump(race_data, f, separators=(',', ':')) # Minified
        
    print(f"\nSUCCESS: Data saved to {filename}")
    print(f"Normalized to viewport X[50, 950] Y[50, 650]")
    
    # Print Manifest Fragment
    manifest_entry = {
        "id": f"{year}-{safe_name.lower()}",
        "name": f"{race_name} Grand Prix",
        "location": "GP Track Info",
        "lapLength": lap_length,
        "sectors": {
            "s1_end": s1_end,
            "s2_end": s2_end
        },
        "sessions": [
            {
                "id": f"{year}-{safe_name.lower()}-sample",
                "name": f"{year} Race (Starter Set)",
                "description": f"Initial {lap_count} laps of the {year} {race_name} GP.",
                "file": f"/data/{year}_{safe_name}_sample.json"
            }
        ]
    }
    print("\n--- MANIFEST ENTRY ---")
    print(json.dumps(manifest_entry, indent=2))
    print("----------------------\n")

if __name__ == "__main__":
    y = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    r = sys.argv[2] if len(sys.argv) > 2 else 'Silverstone'
    l = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    d = sys.argv[4].split(',') if len(sys.argv) > 4 else None
    fetch_circuit(y, r, l, d)
