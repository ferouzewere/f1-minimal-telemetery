import sys
import os
import datetime

# Add scripts to path
sys.path.append(os.getcwd())

from scripts.openf1_service import OpenF1Service

def test_normalization():
    service = OpenF1Service()
    
    # Use a known session key from the bridge server (e.g., 9472)
    session_key = 9506 # Saudi Arabia 2024 Race (?)
    
    print(f"Testing normalization for session {session_key}...")
    
    # 1. Calculate bounds
    bounds = service.calculate_session_bounds(session_key)
    if not bounds:
        print("❌ Failed to calculate bounds")
        return
        
    print(f"✅ Bounds: {bounds}")
    
    # 2. Get track layout
    layout = service.get_track_layout(session_key)
    if not layout:
        print("❌ Failed to get track layout")
        return
        
    print(f"✅ Layout points: {len(layout)}")
    
    # 3. Check scaling
    xs = [p['x'] for p in layout]
    ys = [p['y'] for p in layout]
    
    print(f"Normalized range: X[{min(xs):.1f}, {max(xs):.1f}], Y[{min(ys):.1f}, {max(ys):.1f}]")
    
    # Ensure it fits within 1000x700 with padding
    if min(xs) >= 50 and max(xs) <= 950 and min(ys) >= 50 and max(ys) <= 650:
        print("✅ Normalization confirmed within safety margins")
    else:
        print("⚠️ Normalization margins might be tight or exceeded")

if __name__ == "__main__":
    test_normalization()
