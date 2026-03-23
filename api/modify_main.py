import os

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/api/main.py"

with open(filepath, "r") as f:
    content = f.read()

# Verify starts
if "def download_latest_noaa_data():" not in content:
    print("Function not found")
    exit(1)

download_old = """def download_latest_noaa_data():
    now = datetime.datetime.utcnow()
    date_str = now.strftime("%Y%m%d")
    
    # Determine the latest available NOAA cycle (00, 06, 12, 18)
    # NOAA usually has a delay of ~3-4 hours before a cycle is fully available
    hour = now.hour
    if hour >= 22: cycle = "18"
    elif hour >= 16: cycle = "12"
    elif hour >= 10: cycle = "06"
    else: 
        cycle = "00"
        
    print(f"ShadowBroker: Ophalen NOAA data voor {date_str} run t{cycle}z...")
    
    base_url = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl"
    params = {
        "file": f"gfswave.t{cycle}z.global.0p25.f000.grib2",
        "dir": f"/gfs.{date_str}/{cycle}/wave/gridded"
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=25)
        if response.status_code == 200:
            with open(GRIB_FILE, "wb") as f:
                f.write(response.content)
            print("Intercept Successful: Data stored in live_waves.grib2")
            return True
        else:
            print(f"Intercept Failed: {response.status_code}")
            # Simplistic fallback check: if today failed, try yesterday 18z
            yesterday = now - datetime.timedelta(days=1)
            params["dir"] = f"/gfs.{yesterday.strftime('%Y%m%d')}/18/wave/gridded"
            params["file"] = f"gfswave.t18z.global.0p25.f000.grib2"
            res2 = requests.get(base_url, params=params, timeout=25)
            if res2.status_code == 200:
                with open(GRIB_FILE, "wb") as f:
                    f.write(res2.content)
                return True
            return False
    except Exception as e:
        print(f"Intercept Connection Error: {e}")
        return False"""

# We need to find the full block up to @app.get
start_idx = content.find("def download_latest_noaa_data():")
end_idx = content.find('@app.get("/api/waves")')

if start_idx == -1 or end_idx == -1:
    print("Could not find boundaries")
    exit(1)

# Read get_waves contents to replace it too
# It ends at static files mount or end of file
mount_idx = content.find('static_dir = os.path.join')

if mount_idx == -1:
    print("Could not find mount")
    exit(1)

# New content for the download and logic part
new_block = """WAVE_DATA_CACHE = None

def download_latest_noaa_data():
    now = datetime.datetime.utcnow()
    date_str = now.strftime("%Y%m%d")
    
    # Determine the latest available NOAA cycle (00, 06, 12, 18)
    hour = now.hour
    if hour >= 22: cycle = "18"
    elif hour >= 16: cycle = "12"
    elif hour >= 10: cycle = "06"
    else: 
        cycle = "00"
        
    print(f"ShadowBroker: Ophalen NOAA data voor {date_str} run t{cycle}z...")
    
    base_url = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl"
    params = {
        "file": f"gfswave.t{cycle}z.global.0p25.f000.grib2",
        "dir": f"/gfs.{date_str}/{cycle}/wave/gridded"
    }
    
    temp_file = "temp_" + GRIB_FILE
    
    try:
        response = requests.get(base_url, params=params, timeout=25)
        if response.status_code == 200:
            with open(temp_file, "wb") as f:
                f.write(response.content)
            os.rename(temp_file, GRIB_FILE)
            print("Intercept Successful: Data stored in live_waves.grib2")
            return True
        else:
            print(f"Intercept Failed: {response.status_code}")
            yesterday = now - datetime.timedelta(days=1)
            params["dir"] = f"/gfs.{yesterday.strftime('%Y%m%d')}/18/wave/gridded"
            params["file"] = f"gfswave.t18z.global.0p25.f000.grib2"
            res2 = requests.get(base_url, params=params, timeout=25)
            if res2.status_code == 200:
                with open(temp_file, "wb") as f:
                    f.write(res2.content)
                os.rename(temp_file, GRIB_FILE)
                return True
            return False
    except Exception as e:
        print(f"Intercept Connection Error: {e}")
        if os.path.exists(temp_file):
             os.remove(temp_file)
        return False

def load_wave_data_cache():
    global WAVE_DATA_CACHE
    print("ShadowBroker: Starten van cache initialisatie...")
    if not os.path.exists(GRIB_FILE):
        if not download_latest_noaa_data():
            return False
    import warnings
    warnings.filterwarnings("ignore")
    try:
        ds = xr.open_dataset(GRIB_FILE, engine="cfgrib")
        swh_key = [v for v in ds.variables if 'swh' in v.lower() or 'htsgw' in v.lower()][0]
        dir_key = [v for v in ds.variables if 'dirpw' in v.lower() or 'wvdir' in v.lower()][0]
        ds_thinned = ds[[swh_key, dir_key]].isel(latitude=slice(0, None, 4), longitude=slice(0, None, 4))
        df = ds_thinned.to_dataframe().reset_index()
        ds.close()
        df['longitude'] = (df['longitude'] + 180) % 360 - 180
        df = df.dropna(subset=[swh_key, dir_key, 'latitude', 'longitude'])
        import datetime as dt
        WAVE_DATA_CACHE = {"df": df, "swh_key": swh_key, "dir_key": dir_key, "updated_at": dt.datetime.now()}
        print(f"Cache Initialized: {len(df)} points loaded.")
        return True
    except Exception as e:
        print(f"Cache loading error: {e}")
        return False

def background_periodic_refresh():
    import time
    while True:
        try:
            time.sleep(60 * 60 * 6)
            print("ShadowBroker: Verversen NOAA data...")
            if download_latest_noaa_data():
                 load_wave_data_cache()
        except Exception as e: print(e)

@app.on_event("startup")
async def startup_event():
    load_wave_data_cache()
    import threading
    threading.Thread(target=background_periodic_refresh, daemon=True).start()

@app.get("/api/waves")
def get_waves(
    min_lon: float = Query(-180.0), max_lon: float = Query(180.0),
    min_lat: float = Query(-90.0), max_lat: float = Query(90.0),
    min_height: float = Query(2.0), sample_size: int = Query(2000)
):
    global WAVE_DATA_CACHE
    if WAVE_DATA_CACHE is None:
         if not load_wave_data_cache(): return {"error": "No data"}
    df = WAVE_DATA_CACHE["df"]
    swh_key = WAVE_DATA_CACHE["swh_key"]
    dir_key = WAVE_DATA_CACHE["dir_key"]
    df_f = df[(df[swh_key] >= min_height) & (df['longitude'] >= min_lon) & (df['longitude'] <= max_lon) & (df['latitude'] >= min_lat) & (df['latitude'] <= max_lat)]
    if len(df_f) > sample_size: df_f = df_f.sample(n=sample_size, random_state=42)
    features = []
    for _, r in df_f.iterrows():
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(r['longitude'], 2), round(r['latitude'], 2)]}, "properties": {"swh": round(r[swh_key], 1), "dirpw": round(r[dir_key], 1)}})
    return {"type": "FeatureCollection", "metadata": {"total": len(df_f), "updated_at": str(WAVE_DATA_CACHE.get("updated_at"))}, "features": features}

"""

new_content = content[:start_idx] + new_block + "\n\n" + content[mount_idx:]

with open(filepath, "w") as f:
    f.write(new_content)

print("Modification complete")
