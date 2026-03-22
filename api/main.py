from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import requests
import xarray as xr
import pandas as pd
import datetime
import os

app = FastAPI(title="Global Threat Intercept API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GRIB_FILE = "live_waves.grib2"

def download_latest_noaa_data():
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
        return False

@app.get("/api/waves")
def get_waves(
    min_lon: float = Query(-180.0),
    max_lon: float = Query(180.0),
    min_lat: float = Query(-90.0),
    max_lat: float = Query(90.0),
    min_height: float = Query(2.0, description="Minimum wave height in meters"),
    sample_size: int = Query(2000, description="Max aantal vectoren op de map")
):
    if not os.path.exists(GRIB_FILE):
        success = download_latest_noaa_data()
        if not success:
            return {"error": "Kan NOAA data niet ophalen. Probeer het later."}

    # Open data with xarray & cfgrib
    # Ignore warnings from cfgrib about missing index
    import warnings
    warnings.filterwarnings("ignore")
    
    ds = xr.open_dataset(GRIB_FILE, engine="cfgrib")
    
    # Variables can be labeled differently based on GRIB specs, usually 'swh' and 'dirpw'
    swh_key = [v for v in ds.variables if 'swh' in v.lower() or 'htsgw' in v.lower()][0]
    dir_key = [v for v in ds.variables if 'dirpw' in v.lower() or 'wvdir' in v.lower()][0]
    
    # 0. MEMORY OPTIMIZATION: Subsample before converting to Pandas
    # A full 0.25 degree global grid takes ~1 million rows. We skip some points
    # to prevent the app from crashing on Koyeb's RAM limits.
    ds = ds.isel(latitude=slice(0, None, 2), longitude=slice(0, None, 2))

    # Convert required variables to Pandas DataFrame
    df = ds[[swh_key, dir_key]].to_dataframe().reset_index()

    # == 1. COORDINATE SHIFT ==
    # NOAA gebruikt lon 0-360, MapLibre wil dit in -180 tot 180
    df['longitude'] = (df['longitude'] + 180) % 360 - 180
    
    # == 2. LAND MASKING (De "pixels droppen" stap) ==
    # Als golfhoogte NaN is in de GRIB data (in python np.nan), droppen we die rij.
    # DIT zorgt ervoor dat we geen pijltjes in steden of op de bergen tekenen!
    df = df.dropna(subset=[swh_key, dir_key, 'latitude', 'longitude'])
    
    # == 3. THE SHADOWBROKER THREAT FILTER ==
    # Alleen de hoge golven (> min_height) behouden
    df = df[df[swh_key] >= min_height]
    
    # == 4. BOUNDING BOX FILTER ==
    # Geef alleen data die in beeld is, scheelt datatransfer
    df = df[
        (df['longitude'] >= min_lon) & (df['longitude'] <= max_lon) &
        (df['latitude'] >= min_lat) & (df['latitude'] <= max_lat)
    ]
    
    # == 5. SPATIAL THINNING ==
    # Mocht je ver uitgezoomd zijn, tekenen we niet méér dan `sample_size` pijltjes
    total_points = len(df)
    if total_points > sample_size:
        df = df.sample(n=sample_size, random_state=42) # random_state for stability between identical requests

    # Transformeer naar GeoJSON
    features = []
    for _, row in df.iterrows():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [round(row['longitude'], 2), round(row['latitude'], 2)]
            },
            "properties": {
                "swh": round(row[swh_key], 1),    # Significante Golfhoogte (voor het label)
                "dirpw": round(row[dir_key], 1)   # Piek Golfrichting (voor roteren pijltje)
            }
        })
        
    ds.close() # Free memory
        
    return {
        "type": "FeatureCollection",
        "metadata": {
            "total_threats_found": total_points,
            "threats_shown": len(features),
            "threat_filter_meters": min_height
        },
        "features": features
    }

# Serveer de frontend bestanden (www map)
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "www")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
