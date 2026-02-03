import json
import os
import glob

def check_map_data(file_path):
    print(f"\n>>> INSPECTING: {os.path.basename(file_path)}")
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        if 'drivers' not in data or not data['drivers']:
            print("  ❌ No drivers found.")
            return

        for driver in data['drivers']:
            tel = driver.get('telemetry', [])
            if not tel:
                print(f"  ❌ No telemetry for {driver['driver_abbr']}")
                continue
            
            # Check for x, y keys
            sample = tel[0]
            if 'x' not in sample or 'y' not in sample:
                print(f"  ❌ MISSING COORDINATES for {driver['driver_abbr']}")
                continue
            
            # Get ranges
            xs = [f['x'] for f in tel if 'x' in f]
            ys = [f['y'] for f in tel if 'y' in f]
            
            if not xs or not ys:
                print(f"  ❌ EMPTY COORDINATES for {driver['driver_abbr']}")
                continue

            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            zeros = sum(1 for f in tel if f.get('x') == 0 and f.get('y') == 0)
            
            print(f"  ✅ {driver['driver_abbr']}: Range X[{min_x:.0f}, {max_x:.0f}] Y[{min_y:.0f}, {max_y:.0f}] | Zeros: {zeros}/{len(tel)}")
            
            # Just check first driver for speed unless it's a small file
            if len(data['drivers']) > 5:
                 break

    except Exception as e:
        print(f"  ❌ FAILED: {e}")

if __name__ == "__main__":
    files = glob.glob('public/data/*.json')
    for f in sorted(files):
        check_map_data(f)
