import xarray as xr
import os

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/api/live_waves.grib2"

print("Opening dataset...")
ds = xr.open_dataset(filepath, engine="cfgrib")

swh_key = [v for v in ds.variables if 'swh' in v.lower() or 'htsgw' in v.lower()][0]
dir_key = [v for v in ds.variables if 'dirpw' in v.lower() or 'wvdir' in v.lower()][0]

print(f"Keys: {swh_key}, {dir_key}")

print("Thinning...")
# Try different slices to see shape
ds_thinned = ds[[swh_key, dir_key]].isel(latitude=slice(0, None, 4), longitude=slice(0, None, 4))

print("To Dataframe...")
df = ds_thinned.to_dataframe().reset_index()

print(f"Dataframe columns: {df.columns.tolist()}")
print(f"Dataframe shape: {df.shape}")
print(df.head())

ds.close()
print("Done")
