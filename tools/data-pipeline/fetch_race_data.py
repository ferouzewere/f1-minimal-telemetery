"""
FastF1 Data Ingestion Script
Fetches a real F1 race and converts it to our canonical JSON format.
"""

import fastf1
import pandas as pd
import json
import sys

# Enable FastF1 cache for faster subsequent loads
fastf1.Cache.enable_cache('cache')

def fetch_race(year, race_name, driver_abbr='VER'):
    """
    Fetch race data for a specific driver.
    
    Args:
        year: Race year (e.g., 2024)
        race_name: Race name (e.g., 'Monaco', 'Bahrain')
        driver_abbr: 3-letter driver abbreviation (e.g., 'VER', 'HAM')
    """
    print(f"Loading {year} {race_name} GP...")
    
    # Load the race session
    session = fastf1.get_session(year, race_name, 'R')  # 'R' = Race
    session.load()
    
    # Get driver data
    driver_laps = session.laps.pick_driver(driver_abbr)
    
    if driver_laps.empty:
        print(f"No data found for driver {driver_abbr}")
        return None
    
    # Get the fastest lap for telemetry
    fastest_lap = driver_laps.pick_fastest()
    
    if fastest_lap is None or fastest_lap.empty:
        print("No valid laps found")
        return None
    
    telemetry = fastest_lap.get_telemetry()
    
    # Get track position data
    pos = fastest_lap.get_pos_data()
    
    print(f"Processing {len(telemetry)} telemetry samples...")
    
    # Normalize telemetry data
    telemetry_data = []
    total_distance = telemetry['Distance'].max() if 'Distance' in telemetry.columns else 1.0
    
    for idx, row in telemetry.iterrows():
        # Match position data by time (approximately)
        time_delta = (pos['Time'] - row['Time']).abs()
        closest_idx = time_delta.idxmin() if not time_delta.empty else None
        
        x, y = 500, 350  # Default center position
        if closest_idx is not None:
            pos_row = pos.loc[closest_idx]
            x = float(pos_row['X']) if 'X' in pos.columns else x
            y = float(pos_row['Y']) if 'Y' in pos.columns else y
        
        # Calculate normalized distance
        dist_norm = 0.0
        if 'Distance' in telemetry.columns and pd.notna(row['Distance']):
            dist_norm = float(row['Distance']) / total_distance
        
        telemetry_data.append({
            't': int(row['Time'].total_seconds() * 1000),  # Convert to milliseconds
            'dist': dist_norm,
            'speed': int(row['Speed']) if pd.notna(row['Speed']) else 0,
            'gear': int(row['nGear']) if pd.notna(row['nGear']) and row['nGear'] > 0 else 1,
            'throttle': int(row['Throttle']) if pd.notna(row['Throttle']) else 0,
            'brake': int(row['Brake']) if pd.notna(row['Brake']) else 0,
            'x': x,
            'y': y
        })
    
    # Create canonical race data structure
    race_data = {
        'race_name': f"{year} {race_name} Grand Prix",
        'driver': driver_abbr,
        'track_length': int(total_distance) if total_distance > 1 else 5000,
        'lap_time': float(fastest_lap['LapTime'].total_seconds()),
        'telemetry': telemetry_data
    }
    
    return race_data


def main():
    # Default: 2024 Monaco GP, Verstappen
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    race = sys.argv[2] if len(sys.argv) > 2 else 'Monaco'
    driver = sys.argv[3] if len(sys.argv) > 3 else 'VER'
    
    race_data = fetch_race(year, race, driver)
    
    if race_data:
        output_file = f'public/data/{year}_{race}_{driver}_race.json'
        with open(output_file, 'w') as f:
            json.dump(race_data, f, indent=2)
        
        print(f"\n✅ Race data saved to {output_file}")
        print(f"   Track Length: {race_data['track_length']}m")
        print(f"   Lap Time: {race_data['lap_time']:.3f}s")
        print(f"   Telemetry Samples: {len(race_data['telemetry'])}")
    else:
        print("❌ Failed to fetch race data")


if __name__ == '__main__':
    main()
