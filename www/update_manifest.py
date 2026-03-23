import json
import os

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/www/manifest.json"

with open(filepath, "r") as f:
    data = json.load(f)

# Update with PWA standard fields
data["name"] = "Cruise Master Pro"
data["short_name"] = "CruiseDash"
data["start_url"] = "index.html"
data["display"] = "standalone"
data["background_color"] = "#0a0a1a"
data["theme_color"] = "#0a0a1a"

with open(filepath, "w") as f:
    json.dump(data, f, indent=2)

print("Updated manifest.json")
