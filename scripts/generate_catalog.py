"""
F1 Catalog Generator
Uses FastF1 to create a catalog of all races from 2021-2024.
"""

import fastf1
import json
import os

def generate_catalog():
    print(">>> GENERATING F1 CATALOG...")
    catalog = {"seasons": {}}
    
    for year in range(2021, 2025):
        print(f"  Fetching {year} schedule...")
        try:
            schedule = fastf1.get_event_schedule(year)
            # Filter out testing sessions (only keep actual GPs)
            # FastF1 EventFormat 'Round' indicates a championship race
            races = []
            for _, event in schedule.iterrows():
                if event['RoundNumber'] > 0:
                    races.append({
                        "round": int(event['RoundNumber']),
                        "name": str(event['EventName']).replace(' Grand Prix', ''),
                        "location": f"{event['Location']}, {event['Country']}",
                        "official_name": str(event['EventName'])
                    })
            catalog["seasons"][str(year)] = races
        except Exception as e:
            print(f"    Failed for {year}: {e}")

    output_path = 'public/f1_catalog.json'
    with open(output_path, 'w') as f:
        json.dump(catalog, f, indent=2)
    
    print(f"\n✅ SUCCESS: Catalog saved to {output_path}")

if __name__ == "__main__":
    generate_catalog()
