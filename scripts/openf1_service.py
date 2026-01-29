import requests
import json
import time
from typing import Dict, List, Any, Optional

class OpenF1Service:
    BASE_URL = "https://api.openf1.org/v1"
    
    def __init__(self, norm_width=1000, norm_height=700, padding=50):
        self.norm_width = norm_width
        self.norm_height = norm_height
        self.padding = padding
        self.session_bounds = {} # session_key -> bounds dict
        self.cached_drivers = {} # session_key -> drivers list

    def get_sessions(self, year: Optional[int] = None, session_name: str = "Race"):
        url = f"{self.BASE_URL}/sessions"
        params = {"session_name": session_name}
        if year:
            params["year"] = year
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()

    def get_session_info(self, session_key: int):
        url = f"{self.BASE_URL}/sessions"
        resp = requests.get(url, params={"session_key": session_key}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data[0] if data else None

    def get_drivers(self, session_key: int):
        if session_key in self.cached_drivers:
            return self.cached_drivers[session_key]
            
        url = f"{self.BASE_URL}/drivers"
        response = requests.get(url, params={"session_key": session_key}, timeout=10)
        response.raise_for_status()
        drivers = response.json()
        self.cached_drivers[session_key] = drivers
        return drivers

    def calculate_session_bounds(self, session_key: int):
        """
        Fetches a moderate sample of location data to determine track bounds.
        Uses 5 minutes to ensure at least one full lap is captured in most cases.
        """
        if session_key in self.session_bounds:
            return self.session_bounds[session_key]

        print(f"[OpenF1] Calculating robust bounds for session {session_key}...")
        drivers = self.get_drivers(session_key)
        if not drivers: return None
            
        driver_num = drivers[0]['driver_number']
        session_info = self.get_session_info(session_key)
        if not session_info: return None
        start_date = session_info.get("date_start")
        
        # Use first 5 minutes for a robust bounds check (ensures we see the whole track x/y range)
        import datetime
        dt_start = datetime.datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        robust_end = (dt_start + datetime.timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%S")

        url = f"{self.BASE_URL}/location"
        try:
            start_date_clean = start_date.replace('Z', '').replace('+00:00', '')
            response = requests.get(url, params={
                "session_key": session_key, 
                "driver_number": driver_num,
                "date>": start_date_clean,
                "date<": robust_end
            }, timeout=15)
            locations = response.json()
        except Exception as e:
            print(f"[OpenF1] Error fetching locations for bounds: {e}")
            locations = []
            
        if not locations:
            print(f"[OpenF1] Failed to get any locations for bounds.")
            return None
            
        xs = [l['x'] for l in locations if l['x'] is not None]
        ys = [l['y'] for l in locations if l['y'] is not None]
        
        if not xs or not ys: return None

        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        xr, yr = max_x - min_x, max_y - min_y
        if xr == 0: xr = 1
        if yr == 0: yr = 1
        
        scale = min((self.norm_width - 2*self.padding)/xr, (self.norm_height - 2*self.padding)/yr)
        ox = (self.norm_width - xr*scale)/2
        oy = (self.norm_height - yr*scale)/2
        
        self.session_bounds[session_key] = {
            "min_x": min_x, "max_x": max_x,
            "min_y": min_y, "max_y": max_y,
            "scale": scale, "ox": ox, "oy": oy
        }
        return self.session_bounds[session_key]

    def get_track_layout(self, session_key: int):
        """
        Returns the sampled track layout points for the session.
        Bridge server expects this method.
        """
        provisioned = self.provision_session(session_key)
        return provisioned.get('track_layout', [])

    def normalize_point(self, session_key: int, x: float, y: float):
        bounds = self.session_bounds.get(session_key)
        if not bounds:
            bounds = self.calculate_session_bounds(session_key)
        if not bounds: return x, y
            
        nx = (x - bounds['min_x']) * bounds['scale'] + bounds['ox']
        ny = (y - bounds['min_y']) * bounds['scale'] + bounds['oy']
        return nx, ny

    def provision_session(self, session_key: int):
        """
        Prepares high-res SVG track path using a sample.
        """
        print(f"[OpenF1] Provisioning session {session_key}...")
        bounds = self.calculate_session_bounds(session_key)
        
        drivers_raw = self.get_drivers(session_key)
        if not drivers_raw:
             return {"session_key": session_key, "drivers": [], "track_path": ""}

        driver_num = drivers_raw[0]['driver_number']
        session_info = self.get_session_info(session_key)
        start_date = session_info.get("date_start")
        
        # Fetch first 5 minutes (enough for a lap)
        import datetime
        dt_start = datetime.datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        five_mins = (dt_start + datetime.timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%S")

        print(f"[OpenF1] Fetching geo-sample for driver {driver_num}...")
        try:
            start_date_clean = start_date.replace('Z', '').replace('+00:00', '')
            loc_resp = requests.get(f"{self.BASE_URL}/location", params={
                "session_key": session_key, 
                "driver_number": driver_num,
                "date>": start_date_clean,
                "date<": five_mins
            }, timeout=10)
            locs = loc_resp.json()
        except:
            locs = []
        
        svg_path = ""
        points_data = []
        if locs:
            print(f"[OpenF1] Processing {len(locs)} geo-points...")
            step = max(1, len(locs) // 1000)
            sampled = locs[::step]
            path_segments = []
            
            total_dist = 0
            MAX_GAP = 500 # Max allowed distance between raw points before breaking path
            CLOSE_THRESHOLD = 200 # Max distance to close the loop
            
            for i, p in enumerate(sampled):
                nx, ny = self.normalize_point(session_key, p['x'], p['y'])
                
                is_gap = False
                if i > 0:
                    prev = points_data[-1]
                    # Calculate distance in normalized units for gap detection
                    dist_step = math.hypot(nx - prev['x'], ny - prev['y'])
                    if dist_step > MAX_GAP:
                        is_gap = True
                        print(f"[OpenF1] Gap detected ({dist_step:.1f}), breaking path segment.")
                    else:
                        total_dist += dist_step
                
                points_data.append({"x": nx, "y": ny, "dist": total_dist, "is_gap": is_gap})
                
                cmd = "M" if i == 0 or is_gap else "L"
                path_segments.append(f"{cmd}{nx:.3f} {ny:.3f}")
            
            # Smart closure check
            is_closed = False
            if len(points_data) > 2:
                p_start = points_data[0]
                p_end = points_data[-1]
                if math.hypot(p_end['x'] - p_start['x'], p_end['y'] - p_start['y']) < CLOSE_THRESHOLD:
                    is_closed = True

            # --- DYNAMIC SMOOTHING (Catmull-Rom Spline) ---
            smoothed_path_segments = []
            if len(points_data) >= 4:
                n = len(points_data)
                for i in range(n):
                    # For closed loops, wrap around. For open, clamp.
                    p0 = points_data[(i - 1) % n] if is_closed else points_data[max(0, i-1)]
                    p1 = points_data[i]
                    p2 = points_data[(i + 1) % n] if is_closed else points_data[min(n-1, i+1)]
                    p3 = points_data[(i + 2) % n] if is_closed else points_data[min(n-1, i+2)]
                    
                    # Break smoothing on gaps
                    if points_data[(i+1)%n]['is_gap'] or points_data[i]['is_gap']:
                        smoothed_path_segments.append(f"M{p1['x']:.3f} {p1['y']:.3f}")
                        continue
                    
                    # Generate 4 points per segment
                    for t_idx in range(4):
                        t = t_idx / 4
                        t2, t3 = t*t, t*t*t
                        f1 = -0.5*t3 + t2 - 0.5*t
                        f2 =  1.5*t3 - 2.5*t2 + 1.0
                        f3 = -1.5*t3 + 2.0*t2 + 0.5*t
                        f4 =  0.5*t3 - 0.5*t2
                        
                        sx = p0['x']*f1 + p1['x']*f2 + p2['x']*f3 + p3['x']*f4
                        sy = p0['y']*f1 + p1['y']*f2 + p2['y']*f3 + p3['y']*f4
                        
                        cmd = "M" if i == 0 and t_idx == 0 else "L"
                        smoothed_path_segments.append(f"{cmd}{sx:.3f} {sy:.3f}")
                
                svg_path = "".join(smoothed_path_segments)
                if is_closed: svg_path += "Z"
            else:
                # Fallback to linear if too few points
                svg_path = "".join(path_segments)
                if is_closed: svg_path += "Z"
        
        print(f"[OpenF1] Provisioning complete.")
        return {
            "session_key": session_key,
            "drivers": drivers_raw,
            "track_path": svg_path,
            "track_layout": points_data
        }

    def fetch_live_data(self, session_key: int, last_timestamp: str):
        """
        Fetches telemetry and location data since last_timestamp.
        """
        print(f"[OpenF1] fetch_live_data called: session_key={session_key}, since={last_timestamp}")
        
        # Car Data
        telemetry_url = f"{self.BASE_URL}/car_data"
        try:
            tel_params = {
                "session_key": session_key,
                "date>": last_timestamp
            }
            print(f"[OpenF1] Requesting telemetry: {telemetry_url} with params {tel_params}")
            tel_resp = requests.get(telemetry_url, params=tel_params, timeout=30)
            print(f"[OpenF1] Telemetry response status: {tel_resp.status_code}")
            if tel_resp.status_code == 200:
                tel_data = tel_resp.json()
                print(f"[OpenF1] Telemetry records received: {len(tel_data)}")
            else:
                tel_data = []
                print(f"[OpenF1] Telemetry error response: {tel_resp.text[:200]}")
        except Exception as e:
            print(f"[OpenF1] Telemetry fetch error: {e}")
            tel_data = []
            
        # Location
        location_url = f"{self.BASE_URL}/location"
        try:
            loc_params = {
                "session_key": session_key,
                "date>": last_timestamp
            }
            print(f"[OpenF1] Requesting location: {location_url} with params {loc_params}")
            loc_resp = requests.get(location_url, params=loc_params, timeout=30)
            print(f"[OpenF1] Location response status: {loc_resp.status_code}")
            if loc_resp.status_code == 200:
                loc_data = loc_resp.json()
                print(f"[OpenF1] Location records received: {len(loc_data)}")
            else:
                loc_data = []
                print(f"[OpenF1] Location error response: {loc_resp.text[:200]}")
        except Exception as e:
            print(f"[OpenF1] Location fetch error: {e}")
            loc_data = []
            
        # Weather
        weather_url = f"{self.BASE_URL}/weather"
        try:
            weather_params = {
                "session_key": session_key,
                "date>": last_timestamp
            }
            print(f"[OpenF1] Requesting weather: {weather_url} with params {weather_params}")
            weather_resp = requests.get(weather_url, params=weather_params, timeout=30)
            print(f"[OpenF1] Weather response status: {weather_resp.status_code}")
            weather_data = weather_resp.json() if weather_resp.status_code == 200 else []
            print(f"[OpenF1] Weather records received: {len(weather_data)}")
        except Exception as e:
            print(f"[OpenF1] Weather fetch error: {e}")
            weather_data = []

        return {
            "telemetry": tel_data,
            "location": loc_data,
            "weather": weather_data
        }


if __name__ == "__main__":
    # Quick test
    service = OpenF1Service()
    sessions = service.get_sessions(year=2024)
    if sessions:
        sk = sessions[0]['session_key']
        bounds = service.calculate_session_bounds(sk)
        print(bounds)
