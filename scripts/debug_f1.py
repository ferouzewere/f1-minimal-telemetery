import fastf1
import pandas as pd

fastf1.Cache.enable_cache('cache')
session = fastf1.get_session(2024, 'Zandvoort', 'R')
session.load()

print(f"Total laps: {len(session.laps)}")
ver_laps = session.laps.pick_driver('VER')
print(f"VER laps: {len(ver_laps)}")

if len(ver_laps) > 0:
    lap1 = ver_laps.iloc[0]
    print(f"Lap 1 number: {lap1['LapNumber']}")
    tel = lap1.get_telemetry()
    print(f"Lap 1 telemetry rows: {len(tel)}")
    if len(tel) > 0:
        print(f"Columns: {tel.columns.tolist()}")
else:
    print("No laps for VER")
