import fastf1
import pandas as pd

fastf1.Cache.enable_cache('cache')
session = fastf1.get_session(2024, 'Zandvoort', 'R')
session.load()

ver_laps = session.laps.pick_driver('VER')
lap1 = ver_laps.iloc[0]
tel = lap1.get_telemetry()
print(f"Before add_accel: {len(tel)} rows")
try:
    tel = tel.add_acceleration()
    print(f"After add_accel: {len(tel)} rows")
    if 'Ax' in tel.columns:
        print("Ax present")
except Exception as e:
    print(f"Error: {e}")
