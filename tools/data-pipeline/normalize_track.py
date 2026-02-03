"""
Track Geometry Processor
Normalizes track position data to fit within SVG viewport.
"""

import json
import sys

def normalize_track_data(input_file, output_file=None, width=1000, height=700, padding=50):
    """
    Read race data and normalize track coordinates to fit in viewport.
    
    Args:
        input_file: Path to race data JSON
        output_file: Path to save normalized data (optional, overwrites input by default)
        width: Target viewport width
        height: Target viewport height  
        padding: Padding around the track
    """
    print(f"Processing {input_file}...")
    
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Handle both single-driver and multi-driver formats
    if 'telemetry' in data:
        # Single driver format
        telemetry_sets = [data['telemetry']]
    elif 'drivers' in data:
        # Multi-driver format
        telemetry_sets = [driver['telemetry'] for driver in data['drivers']]
    else:
        print("❌ Unknown data format")
        return
    
    # Collect all coordinates from all drivers
    all_x_coords = []
    all_y_coords = []
    
    for telemetry in telemetry_sets:
        all_x_coords.extend([point['x'] for point in telemetry])
        all_y_coords.extend([point['y'] for point in telemetry])
    
    # Find global bounds
    min_x, max_x = min(all_x_coords), max(all_x_coords)
    min_y, max_y = min(all_y_coords), max(all_y_coords)
    
    # Calculate scale factors
    x_range = max_x - min_x
    y_range = max_y - min_y
    
    # Use the same scale for both to avoid distortion
    scale = min((width - 2 * padding) / x_range, (height - 2 * padding) / y_range)
    
    # Calculate offsets to center the track
    scaled_width = x_range * scale
    scaled_height = y_range * scale
    x_offset = (width - scaled_width) / 2
    y_offset = (height - scaled_height) / 2
    
    print(f"Original bounds: X[{min_x:.1f}, {max_x:.1f}], Y[{min_y:.1f}, {max_y:.1f}]")
    print(f"Scale: {scale:.3f}, Offsets: ({x_offset:.1f}, {y_offset:.1f})")
    
    # Normalize all coordinates
    for telemetry in telemetry_sets:
        for point in telemetry:
            point['x'] = (point['x'] - min_x) * scale + x_offset
            point['y'] = (point['y'] - min_y) * scale + y_offset
    
    # Save normalized data
    output_path = output_file or input_file
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✅ Normalized track data saved to {output_path}")
    print(f"   New bounds: X[{padding}, {width-padding}], Y[{padding}, {height-padding}]")

def main():
    if len(sys.argv) < 2:
        print("Usage: python normalize_track.py <race_data.json> [output.json]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    normalize_track_data(input_file, output_file)

if __name__ == '__main__':
    main()
