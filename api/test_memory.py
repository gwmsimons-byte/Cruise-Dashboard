import xarray as xr
import os
import psutil

def print_memory():
    process = psutil.Process()
    print(f"Memory: {process.memory_info().rss / (1024*1024):.1f} MB")

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/api/live_waves.grib2"

print_memory()
print("Opening dataset...")
ds = xr.open_dataset(filepath, engine="cfgrib")
print_memory()

# Mimic main.py
swh_key = [v for v in ds.variables if 'swh' in v.lower() or 'htsgw' in v.lower()][0]
dir_key = [v for v in ds.variables if 'dirpw' in v.lower() or 'wvdir' in v.lower()][0]

print(f"Keys: {swh_key}, {dir_key}")

print("Thinning...")
ds_thinned = ds[[swh_key, dir_key]].isel(latitude=slice(0, None, 4), longitude=slice(0, None, 4))
print_memory()

print("To Dataframe...")
df = ds_thinned.to_dataframe()
print_memory()

print(f"Dataframe rows: {len(df)}")
print(df.head())

ds.close()
print("Done")
print_memory()
