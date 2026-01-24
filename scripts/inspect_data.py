import json

file_path = r'c:\Users\ferou\Downloads\Projects\f1_minimal_telemetery\public\data\2024_Monaco_phase2.json'

with open(file_path, 'r') as f:
    data = json.load(f)

for driver in data.get('drivers', []):
    print(f"DRIVER: {driver.get('driver_abbr')}")
    print(f"  KEYS: {list(driver.keys())}")
    
    # Check for stints or laps
    if 'stints' in driver:
        print(f"  STINTS: {len(driver['stints'])} items")
    
    if 'laps' in driver:
        l = driver['laps']
        print(f"  LAPS: {len(l)} items")
        if len(l) > 0:
            print(f"  LAP SAMPLE: {l[0]}")
    else:
        print("  NO 'laps' KEY FOUND")
    
    t = driver.get('telemetry', [])
    if t:
        print(f"  TELEMETRY: {len(t)} frames")
    
    # Exit after first driver to see output clearly
    break
