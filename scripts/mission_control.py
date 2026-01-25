"""
Unified Mission Control
Orchestrates mission additions and deletions.
"""

import os
import sys
import json
import subprocess

def delete_mission(circuit_id):
    print(f">>> DECOMMISSIONING MISSION: {circuit_id}")
    
    try:
        manifest_path = 'public/sessions.json'
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        # 1. Find and remove from manifest
        circuit_to_remove = None
        for circuit in manifest['circuits']:
            if circuit['id'] == circuit_id:
                circuit_to_remove = circuit
                break
        
        if not circuit_to_remove:
            print(f"  ❌ Mission {circuit_id} not found in manifest.")
            return

        manifest['circuits'] = [c for c in manifest['circuits'] if c['id'] != circuit_id]
        
        # 2. Cleanup data files
        for session in circuit_to_remove['sessions']:
            data_file = session['file'].lstrip('/')
            if os.path.exists(f"public/{data_file}"):
                print(f"  🗑️ Deleting data: {data_file}")
                os.remove(f"public/{data_file}")
        
        # 3. Save manifest
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=4)
            
        print(f"\n✅ SUCCESS: Mission {circuit_id} removed from hub.")
        
    except Exception as e:
        print(f"❌ Decommission failed: {e}")

if __name__ == "__main__":
    mode = sys.argv[1].lower() if len(sys.argv) > 1 else None
    
    if mode == "delete":
        if len(sys.argv) > 2:
            delete_mission(sys.argv[2])
        else:
            print("Usage: python scripts/mission_control.py delete <circuit_id>")
    
    elif mode == "add":
        # Just a wrapper for add_historical_race_full.py
        # Usage: python scripts/mission_control.py add 2024 "Monaco Grand Prix"
        if len(sys.argv) >= 4:
            year = sys.argv[2]
            race = sys.argv[3]
            laps = sys.argv[4] if len(sys.argv) > 4 else "5"
            subprocess.run(["python", "scripts/add_historical_race_full.py", year, race, laps])
        else:
            print("Usage: python scripts/mission_control.py add <year> <race_official_name>")
