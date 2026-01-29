import json
import os
import math

def distance(a, b):
    # Support both 'x'/'y' (telemetry) and 'X'/'Y' (fastf1 raw)
    ax = a.get('x') if a.get('x') is not None else a.get('X')
    ay = a.get('y') if a.get('y') is not None else a.get('Y')
    bx = b.get('x') if b.get('x') is not None else b.get('X')
    by = b.get('y') if b.get('y') is not None else b.get('Y')
    
    if ax is None or ay is None or bx is None or by is None:
        return 0
    return math.hypot(ax - bx, ay - by)

def catmull_rom_spline(p0, p1, p2, p3, num_samples=5):
    """Calculates Catmull-Rom spline points between p1 and p2."""
    pts = []
    for i in range(num_samples):
        t = i / num_samples
        t2 = t * t 
        t3 = t2 * t
        
        # Coefficients for Catmull-Rom
        f1 = -0.5*t3 + t2 - 0.5*t
        f2 =  1.5*t3 - 2.5*t2 + 1.0
        f3 = -1.5*t3 + 2.0*t2 + 0.5*t
        f4 =  0.5*t3 - 0.5*t2
        
        x = p0[0]*f1 + p1[0]*f2 + p2[0]*f3 + p3[0]*f4
        y = p0[1]*f1 + p1[1]*f2 + p2[1]*f3 + p3[1]*f4
        pts.append((x, y))
    return pts

def smooth_points(points, samples_per_segment=8):
    if len(points) < 4:
        return points
    
    # Extract coordinates
    coords = []
    for p in points:
        x = p.get('x') if p.get('x') is not None else p.get('X', 0)
        y = p.get('y') if p.get('y') is not None else p.get('Y', 0)
        coords.append((x, y))
        
    smoothed = []
    # We need p0, p1, p2, p3 to interpolate between p1 and p2
    # For a closed loop, we can wrap around
    n = len(coords)
    for i in range(n):
        p0 = coords[(i - 1) % n]
        p1 = coords[i]
        p2 = coords[(i + 1) % n]
        p3 = coords[(i + 2) % n]
        
        # Check for jumps - don't smooth across breaks
        if math.hypot(p1[0]-p2[0], p1[1]-p2[1]) > 50:
            smoothed.append(p1)
            continue
            
        segment_pts = catmull_rom_spline(p0, p1, p2, p3, samples_per_segment)
        smoothed.extend(segment_pts)
        
    return [{'x': p[0], 'y': p[1]} for p in smoothed]

def generate_svg_path(points, max_jump=50.0, close_threshold=10.0, smooth=True):
    if not points:
        return ""

    # Apply Smoothing if requested
    target_points = smooth_points(points) if smooth else points

    # Initial Move
    p0 = target_points[0]
    p0x = p0['x']
    p0y = p0['y']
    
    path_segments = [f"M{p0x:.3f} {p0y:.3f}"]
    prev = target_points[0]

    for p in target_points[1:]:
        px, py = p['x'], p['y']
        
        # Use a slightly larger jump threshold for smoothed points as they are denser
        if math.hypot(prev['x'] - px, prev['y'] - py) > max_jump:
            path_segments.append(f"M{px:.3f} {py:.3f}")
        else:
            path_segments.append(f"L{px:.3f} {py:.3f}")
        prev = p

    # Only close if end is near start (on original points check)
    if distance(points[0], points[-1]) < close_threshold:
        path_segments.append("Z")

    return "".join(path_segments)

def resample_by_distance(points, min_step=5.0):
    if not points:
        return []
    
    sampled = [points[0]]
    acc = 0.0

    for i in range(1, len(points)):
        d = distance(points[i-1], points[i])
        acc += d
        if acc >= min_step:
            sampled.append(points[i])
            acc = 0.0

    return sampled

def process_files():
    data_dir = "public/data"
    sessions_file = "public/sessions.json"
    
    if not os.path.exists(sessions_file):
        print(f"Error: {sessions_file} not found")
        return

    with open(sessions_file, 'r') as f:
        sessions_data = json.load(f)
        
    for circuit in sessions_data['circuits']:
        found_file = False
        # Prioritize 'full' grid data if available
        sample_files = sorted(circuit['sessions'], key=lambda s: "full" in s['file'], reverse=True)
        
        for session in sample_files:
            file_path = os.path.join(os.getcwd(), 'public', session['file'].lstrip('/'))
            if os.path.exists(file_path):
                print(f"Generating high-res path for {circuit['name']} from {session['file']}...")
                try:
                    with open(file_path, 'r') as df:
                        race_data = json.load(df)
                        
                        # Find the cleanest lap across all drivers
                        all_laps = {}
                        for driver in race_data.get('drivers', []):
                            for p in driver.get('telemetry', []):
                                if (p.get('x') or p.get('X')) and p.get('lap'):
                                    all_laps.setdefault(p['lap'], []).append(p)
                        
                        if not all_laps:
                            continue
                            
                        # Choose lap with most samples (likely the most complete one)
                        best_lap_num = max(all_laps.keys(), key=lambda l: len(all_laps[l]))
                        lap_tel = all_laps[best_lap_num]
                        
                        # Sort by distance or time to ensure sequence
                        lap_tel.sort(key=lambda p: p.get('dist', 0) or p.get('t', 0))
                        
                        # Distance-based resampling for smooth path without corner cutting
                        sampled = resample_by_distance(lap_tel, min_step=2.0)
                        
                        path = generate_svg_path(sampled)
                        circuit['track_path'] = path
                        found_file = True
                        print(f"  ✅ High-res path generated (Lap {best_lap_num}, {len(sampled)} points)")
                        break
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
        
        if not found_file:
            print(f"Could not find data file for {circuit['name']}")

    with open(sessions_file, 'w') as f:
        json.dump(sessions_data, f, indent=4)
        
    print("\nDONE: sessions.json updated with high-fidelity SVG paths.")

if __name__ == "__main__":
    process_files()
