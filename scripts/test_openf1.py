import requests
import json

def test_openf1():
    print("Testing OpenF1 API connection...")
    
    try:
        # Get a session
        sessions_url = "https://api.openf1.org/v1/sessions?year=2024&session_name=Race"
        response = requests.get(sessions_url)
        sessions = response.json()
        session = sessions[0] # Try first one
        session_key = session['session_key']
        print(f"Session: {session['session_name']} (Key: {session_key})")
        
        # Get drivers
        drivers_url = f"https://api.openf1.org/v1/drivers?session_key={session_key}"
        response = requests.get(drivers_url)
        drivers = response.json()
        print(f"Found {len(drivers)} drivers.")
        if drivers:
            print(f"First driver: {drivers[0]['full_name']} ({drivers[0]['driver_number']})")
            
        # Get one location point without time filter
        loc_url = f"https://api.openf1.org/v1/location?session_key={session_key}&driver_number={drivers[0]['driver_number']}"
        response = requests.get(loc_url)
        locations = response.json()
        print(f"Fetched {len(locations)} location points (unfiltered).")
        if locations:
            print(f"Sample point: {locations[0]}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_openf1()
