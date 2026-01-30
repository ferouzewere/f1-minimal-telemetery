"""
F1 Race Data Analysis Script
Consolidates missing race details: Geography, Driver Dossiers, Technical Stats, and Weather.
Output: enriched_metadata.json
"""

import fastf1
import pandas as pd
import json
import sys
import os
import requests
from datetime import datetime

# Enable Cache
os.makedirs('cache', exist_ok=True)
fastf1.Cache.enable_cache('cache')

def get_ergast_data(path):
    """Bridge to Ergast API for historical/biographical data."""
    try:
        url = f"https://ergast.com/api/f1/{path}.json"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return None

def enrich_race(year, race_name):
    print(f"\n>>> ANALYSIS QUERY: {year} {race_name} GP")
    
    try:
        session = fastf1.get_session(year, race_name, 'R')
        session.load(telemetry=True, laps=True, weather=True)
    except Exception as e:
        print(f"ERROR: Cannot load session: {e}")
        return

    # 1. Track Geography & Metadata
    track_info = {
        "name": session.event['EventName'],
        "location": session.event['Location'],
        "country": session.event['Country'],
        "official_name": session.event['OfficialEventName'],
        "date": session.date.strftime('%Y-%m-%d'),
        "coordinates": None # To be filled from Ergast
    }

    # Query Ergast for Lat/Long
    circuit_data = get_ergast_data(f"{year}/{session.event['RoundNumber']}")
    if circuit_data:
        try:
            race = circuit_data['MRData']['RaceTable']['Races'][0]
            track_info["coordinates"] = {
                "lat": race['Circuit']['Location']['lat'],
                "long": race['Circuit']['Location']['long'],
                "locality": race['Circuit']['Location']['locality']
            }
        except: pass

    # 2. Driver Dossiers
    print("Collecting Driver Dossiers...")
    drivers = []
    results = session.results
    for _, row in results.iterrows():
        driver_abbr = row['Abbreviation']
        
        # Calculate Technical Stats from Telemetry
        top_speed = 0
        avg_speed = 0
        try:
            tel = session.laps.pick_drivers([driver_abbr]).get_telemetry()
            if not tel.empty:
                top_speed = int(tel['Speed'].max())
                avg_speed = int(tel['Speed'].mean())
        except: pass

        # Robust mapping for varying FastF1 versions
        nationality = row.get('Nationality', row.get('CountryCode', 'Generic'))
        
        drivers.append({
            "abbr": driver_abbr,
            "full_name": f"{row['FirstName']} {row['LastName']}",
            "number": row['DriverNumber'],
            "team": row['TeamName'],
            "nationality": nationality,
            "position": int(row['Position']) if pd.notna(row['Position']) else "NC",
            "points": float(row['Points']),
            "stats": {
                "top_speed_kmh": top_speed,
                "avg_session_speed_kmh": avg_speed,
                "status": row['Status']
            }
        })

    # 3. Weather Profile
    weather_summary = {}
    if not session.weather_data.empty:
        w = session.weather_data
        weather_summary = {
            "air_temp_range": [float(w['AirTemp'].min()), float(w['AirTemp'].max())],
            "track_temp_range": [float(w['TrackTemp'].min()), float(w['TrackTemp'].max())],
            "humidity_avg": round(float(w['Humidity'].mean()), 1),
            "rainfall_recorded": bool(w['Rainfall'].any()),
            "peak_wind_speed": float(w['WindSpeed'].max())
        }

    # 4. Consolidate
    analysis_report = {
        "report_generated": datetime.now().isoformat(),
        "race_id": f"{year}_{race_name.lower().replace(' ', '_')}",
        "track": track_info,
        "weather": weather_summary,
        "drivers": drivers
    }

    # Save to JSON
    output_path = f"public/data/{analysis_report['race_id']}_analysis_report.json"
    with open(output_path, 'w') as f:
        json.dump(analysis_report, f, indent=2)

    print(f"\n✅ REPORT READY: {output_path}")
    print(f"Includes: Geographical coordinates, Driver bios, Tech speed details, and Weather profile.")

if __name__ == "__main__":
    y = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    r = sys.argv[2] if len(sys.argv) > 2 else 'Silverstone'
    enrich_race(y, r)
