
import json
import os
import sys

def optimize_race_data(input_path, output_path):
    print(f"Loading {input_path}...")
    try:
        with open(input_path, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found at {input_path}")
        return

    original_size = os.path.getsize(input_path) / (1024 * 1024)
    print(f"Original size: {original_size:.2f} MB")

    print("Optimizing data...")
    
    # Process each driver
    if 'drivers' in data:
        for driver in data['drivers']:
            # Optimize telemetry
            if 'telemetry' in driver:
                optimized_telemetry = []
                for point in driver['telemetry']:
                    # Create a new point with only necessary fields and reduced precision
                    new_point = {
                        't': point['t'],
                        'dist': round(point['dist'], 2),
                        'speed': int(point['speed']),
                    }
                    
                    # Optional: Add x, y only if used (assuming map uses them)
                    # Rounding to 1 decimal place is usually sufficient for screen coords
                    if 'x' in point:
                        new_point['x'] = round(point['x'], 3)
                    if 'y' in point:
                        new_point['y'] = round(point['y'], 3)
                        
                    # Include other necessary fields if they exist and are needed
                    # For minimal telemetry, maybe we don't need gear/throttle/brake for every point if not visualized
                    if 'gear' in point:
                        new_point['gear'] = point['gear']
                    if 'throttle' in point:
                        new_point['throttle'] = point['throttle']
                    if 'brake' in point:
                        new_point['brake'] = point['brake']
                    
                    # Tyre data is often repeated, maybe only keep it on change?
                    # For now keep simple: simple fields
                    if 'drs' in point:
                         new_point['drs'] = point['drs']

                    optimized_telemetry.append(new_point)
                
                driver['telemetry'] = optimized_telemetry

    print(f"Saving optimized data to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(data, f, separators=(',', ':')) # Remove whitespace for minification

    new_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Optimized size: {new_size:.2f} MB")
    print(f"Reduction: {((original_size - new_size) / original_size) * 100:.1f}%")

if __name__ == "__main__":
    input_file = "public/data/2024_Monaco_full_grid.json"
    output_file = "public/data/2024_Monaco_full_grid_optimized.json"
    
    # Allow overriding paths via args
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
        
    optimize_race_data(input_file, output_file)
