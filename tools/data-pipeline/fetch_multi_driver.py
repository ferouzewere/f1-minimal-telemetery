"""
Multi-Driver Data Fetcher
Fetches race data for multiple drivers and combines them.
"""

import fastf1
import pandas as pd
import json
import sys

fastf1.Cache.enable_cache('cache')

def fetch_multi_driver_race(year, race_name, driver_list):
    """
    Fetch race data for multiple drivers.
    
    Args:
        year: Race year
        race_name: Race name
        driver_list: List of driver abbreviations ['VER', 'HAM', 'LEC']
    """
    print(f"Loading {year} {race_name} GP...")
    
    session = fastf1.get_session(year, race_name, 'R')
    session.load()
    
    all_drivers_data = []
    
    for driver_abbr in driver_list:
        print(f"\nProcessing driver: {driver_abbr}")
        
        driver_laps = session.laps.pick_drivers([driver_abbr])
        
        if driver_laps.empty:
            print(f"  ⚠️  No data for {driver_abbr}")
            continue
        
        fastest_lap = driver_laps.pick_fastest()
        
        if fastest_lap is None or fastest_lap.empty:
            print(f"  ⚠️  No valid laps for {driver_abbr}")
            continue
        
        telemetry = fastest_lap.get_telemetry()
        pos = fastest_lap.get_pos_data()
        
        # Get driver info from the results
        try:
            results = session.results
            driver_result = results[results['Abbreviation'] == driver_abbr]
            
            if not driver_result.empty:
                driver_name = f"{driver_result.iloc[0]['FirstName']} {driver_result.iloc[0]['LastName']}"
                team = driver_result.iloc[0]['TeamName'] if 'TeamName' in driver_result.columns else driver_abbr
            else:
                driver_name = driver_abbr
                team = 'Unknown'
        except Exception as e:
            print(f"  ⚠️  Could not get driver info: {e}")
            driver_name = driver_abbr
            team = 'Unknown'
        
        # Normalize telemetry
        telemetry_data = []
        total_distance = telemetry['Distance'].max() if 'Distance' in telemetry.columns else 1.0
        
        for idx, row in telemetry.iterrows():
            time_delta = (pos['Time'] - row['Time']).abs()
            closest_idx = time_delta.idxmin() if not time_delta.empty else None
            
            x, y = 500, 350
            if closest_idx is not None:
                pos_row = pos.loc[closest_idx]
                x = float(pos_row['X']) if 'X' in pos.columns else x
                y = float(pos_row['Y']) if 'Y' in pos.columns else y
            
            dist_norm = 0.0
            if 'Distance' in telemetry.columns and pd.notna(row['Distance']):
                dist_norm = float(row['Distance']) / total_distance
            
            telemetry_data.append({
                't': int(row['Time'].total_seconds() * 1000),
                'dist': dist_norm,
                'speed': int(row['Speed']) if pd.notna(row['Speed']) else 0,
                'gear': int(row['nGear']) if pd.notna(row['nGear']) and row['nGear'] > 0 else 1,
                'throttle': int(row['Throttle']) if pd.notna(row['Throttle']) else 0,
                'brake': int(row['Brake']) if pd.notna(row['Brake']) else 0,
                'x': x,
                'y': y
            })
        
        driver_data = {
            'driver_abbr': driver_abbr,
            'driver_name': driver_name,
            'team': team,
            'lap_time': float(fastest_lap['LapTime'].total_seconds()),
            'telemetry': telemetry_data
        }
        
        all_drivers_data.append(driver_data)
        print(f"  ✅ {driver_abbr}: {len(telemetry_data)} samples, {driver_data['lap_time']:.3f}s")
    
    # Create combined race data
    race_data = {
        'race_name': f"{year} {race_name} Grand Prix",
        'year': year,
        'circuit': race_name,
        'drivers': all_drivers_data
    }
    
    return race_data

def main():
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    race = sys.argv[2] if len(sys.argv) > 2 else 'Monaco'
    drivers = sys.argv[3:] if len(sys.argv) > 3 else ['VER', 'HAM', 'LEC']
    
    race_data = fetch_multi_driver_race(year, race, drivers)
    
    if race_data and race_data['drivers']:
        output_file = f'public/data/{year}_{race}_multi.json'
        with open(output_file, 'w') as f:
            json.dump(race_data, f, indent=2)
        
        print(f"\n✅ Multi-driver race data saved to {output_file}")
        print(f"   Drivers: {len(race_data['drivers'])}")
    else:
        print("❌ Failed to fetch race data")

if __name__ == '__main__':
    main()
