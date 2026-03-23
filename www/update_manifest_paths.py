import json

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/www/manifest.json"

with open(filepath, "r") as f:
    data = json.load(f)

# Update icon paths
for icon in data.get("icons", []):
    if "../icons/" in icon["src"]:
        icon["src"] = icon["src"].replace("../icons/", "icons/")

with open(filepath, "w") as f:
    json.dump(data, f, indent=2)

print("Removed ../ from icons in manifest.json")
