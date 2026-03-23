import xarray as xr
import os

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/api/live_waves.grib2"

if not os.path.exists(filepath):
    print("File not found")
else:
    try:
        ds = xr.open_dataset(filepath, engine="cfgrib")
        print("--- Dataset ---")
        print(ds)
        print("\n--- Dimensions ---")
        print(ds.dims)
        print("\n--- Variables ---")
        for v in ds.variables:
            print(f"- {v}: {ds[v].dims}")
            # print first value shape/content
        
    except Exception as e:
        print("Error reading dataset:", e)
