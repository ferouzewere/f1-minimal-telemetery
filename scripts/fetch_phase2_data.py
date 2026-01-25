"""
Comprehensive Multi-Driver Race Data Fetcher
Fetches full race telemetry, tyre stints, and pit stop data for multiple drivers.
"""

import fastf1
import pandas as pd
import json
import sys
import numpy as np

# Enable FastF1 cache
fastf1.Cache.enable_cache('cache')

def fetch_full_race_data(year, race_name, driver_list):
    """
    Fetch full race data for multiple drivers including all laps and strategy.
    """
    print(f"Loading {year} {race_name} GP Full Race Data...")
    
    session = fastf1.get_session(year, race_name, 'R')
    session.load(telemetry=True, laps=True, weather=True) # Enabled weather
    
    # Fetch Weather Data
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
        print(f"  ⚠️ Could not fetch weather: {e}")

    # Fetch Track Status (Safety Car, Flags)
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
        print(f"  ⚠️ Could not fetch track status: {e}")

    all_drivers_data = []
    laps = session.laps
    
    for driver_abbr in driver_list:
        print(f"\nProcessing driver: {driver_abbr}")
        driver_laps = laps.pick_drivers([driver_abbr])
        
        if driver_laps.empty:
            continue
            
        try:
            results = session.results
            driver_result = results[results['Abbreviation'] == driver_abbr]
            if not driver_result.empty:
                driver_name = f"{driver_result.iloc[0]['FirstName']} {driver_result.iloc[0]['LastName']}"
                team = driver_result.iloc[0]['TeamName']
                color = driver_result.iloc[0]['TeamColor']
            else:
                driver_name = driver_abbr
                team = 'Unknown'
                color = 'FFFFFF'
        except:
            driver_name = driver_abbr
            team = 'Unknown'
            color = 'FFFFFF'

        stints = []
        stint_groups = driver_laps.groupby('Stint')
        for stint_num, stint_laps in stint_groups:
            stints.append({
                'compound': str(stint_laps['Compound'].iloc[0]),
                'stint': int(stint_num),
                'start_lap': int(stint_laps['LapNumber'].iloc[0]),
                'count': len(stint_laps)
            })

        # Process telemetry (All laps for better visualization)
        telemetry_data = []
        total_dist_so_far = 0
        
        # Limit to 10 laps for "full race" sample to keep file size reasonable for now
        # or process all if you want truly full data. 
        # For this 'Phase 2' sample, let's do more than 3.
        sample_laps = driver_laps.iloc[0:10] 
        
        for _, lap in sample_laps.iterrows():
            try:
                lap_telemetry = lap.get_telemetry()
                pos = lap.get_pos_data()
                
                is_pit_stop = pd.notna(lap['PitInTime']) or pd.notna(lap['PitOutTime'])
                lap_max_dist = lap_telemetry['Distance'].max()
                
                for idx, row in lap_telemetry.iterrows():
                    time_delta = (pos['Time'] - row['Time']).abs()
                    closest_idx = time_delta.idxmin() if not time_delta.empty else None
                    
                    x, y = 0, 0
                    if closest_idx is not None:
                        pos_row = pos.loc[closest_idx]
                        x = float(pos_row['X'])
                        y = float(pos_row['Y'])
                    
                    telemetry_data.append({
                        't': int(row['Time'].total_seconds() * 1000),
                        'lap': int(lap['LapNumber']),
                        'dist': float(row['Distance']) + total_dist_so_far,
                        'speed': int(row['Speed']),
                        'rpm': int(row['RPM']) if 'RPM' in row else 0, # Added RPM
                        'gear': int(row['nGear']),
                        'throttle': int(row['Throttle']),
                        'brake': int(row['Brake']),
                        'drs': int(row['DRS']) if 'DRS' in row else 0,
                        'x': x,
                        'y': y,
                        'compound': str(lap['Compound']),
                        'tyre_age': int(lap['TyreLife']),
                        'is_pit': is_pit_stop
                    })
                
                total_dist_so_far += lap_max_dist
            except Exception as e:
                print(f"  ⚠️ Error on lap {lap['LapNumber']}: {e}")
                continue

        driver_data = {
            'driver_abbr': driver_abbr,
            'driver_name': driver_name,
            'team': team,
            'team_color': f"#{color}",
            'stints': stints,
            'telemetry': telemetry_data
        }
        
        all_drivers_data.append(driver_data)
        print(f"  ✅ {driver_abbr}: {len(telemetry_data)} samples")

    race_data = {
        'race_name': f"{year} {race_name} Grand Prix (Phase 2 Full)",
        'year': year,
        'circuit': race_name,
        'weather': weather_data,
        'track_status': track_status_data,
        'drivers': all_drivers_data
    }
    
    return race_data

def main():
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    race = sys.argv[2] if len(sys.argv) > 2 else 'Monaco'
    
    # Load session once to get all driver abbreviations
    print(f"Detecting drivers for {year} {race} GP...")
    session = fastf1.get_session(year, race, 'R')
    session.load(telemetry=False, laps=True, weather=False)
    all_driver_abbrs = list(session.results['Abbreviation'].unique())
    
    print(f"Found {len(all_driver_abbrs)} drivers: {', '.join(all_driver_abbrs)}")
    
    race_data = fetch_full_race_data(year, race, all_driver_abbrs)
    
    if race_data and race_data['drivers']:
        output_file = f'public/data/{year}_{race}_full_grid.json'
        with open(output_file, 'w') as f:
            json.dump(race_data, f, indent=2)
        print(f"\n✅ Full Grid data saved to {output_file}")
    else:
        print("❌ Failed to fetch data")

if __name__ == '__main__':
    main()
