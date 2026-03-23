import os

filepath_app = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/www/app.js"
filepath_it = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/www/itinerary.js"

# 1. Update app.js
with open(filepath_app, "r") as f:
    app_content = f.read()

# Replace LocaleTimeString to force 24h format
target1 = "toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })"
replacement1 = "toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })"

app_content = app_content.replace(target1, replacement1)

# Inject Cache Invalidation inside loadTimeline()
target2 = """function loadTimeline() {
    const saved = localStorage.getItem('cmp_cruise_timeline');"""

replacement2 = """function loadTimeline() {
    // Forceer eenmalige reset om caching van oude schema's te voorkomen
    if (!localStorage.getItem('force_load_new_itinerary_v3')) {
        localStorage.removeItem('cmp_cruise_timeline');
        localStorage.setItem('force_load_new_itinerary_v3', 'true');
    }
    const saved = localStorage.getItem('cmp_cruise_timeline');"""

if target2 in app_content:
    app_content = app_content.replace(target2, replacement2)
    print("Added cache invalidation inside loadTimeline()")
else:
    print("Could not find loadTimeline for cache override")

with open(filepath_app, "w") as f:
    f.write(app_content)


# 2. Update itinerary.js to ensure exact CSV dump contents with 24h compatibility
new_itinerary = """/* CRUISE TIMELINE
   A modern, event-based itinerary system.
*/

let CRUISE_TIMELINE = [
    { type: "DEPARTURE", port: "BA_START", name: "Buenos Aires, Argentina", time: "2026-03-30T17:00:00Z" },

    { type: "SEA_DAY", date: "2026-03-31", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-01", name: "At Sea" },

    { type: "ARRIVAL", port: "RIO_PORT", name: "Rio de Janeiro, Brazil", time: "2026-04-02T10:30:00Z" },
    { type: "DEPARTURE", port: "RIO_PORT", name: "Rio de Janeiro, Brazil", time: "2026-04-02T18:00:00Z" },

    { type: "SEA_DAY", date: "2026-04-03", name: "At Sea" },

    { type: "ARRIVAL", port: "SALVADOR", name: "Salvador de Bahia, Brazil", time: "2026-04-04T10:30:00Z" },
    { type: "DEPARTURE", port: "SALVADOR", name: "Salvador de Bahia, Brazil", time: "2026-04-04T17:30:00Z" },

    { type: "SEA_DAY", date: "2026-04-05", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-06", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-07", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-08", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-09", name: "At Sea" },
    { type: "SEA_DAY", date: "2026-04-10", name: "At Sea" },

    { type: "ARRIVAL", port: "TENERIFE", name: "Tenerife, Canary Islands", time: "2026-04-11T09:00:00Z" },
    { type: "DEPARTURE", port: "TENERIFE", name: "Tenerife, Canary Islands", time: "2026-04-11T18:00:00Z" },

    { type: "SEA_DAY", date: "2026-04-12", name: "At Sea" },

    { type: "ARRIVAL", port: "CADIZ", name: "Seville (Cadiz), Spain", time: "2026-04-13T10:00:00Z" },
    { type: "DEPARTURE", port: "CADIZ", name: "Seville (Cadiz), Spain", time: "2026-04-13T19:00:00Z" },

    { type: "ARRIVAL", port: "MALAGA", name: "Malaga, Spain", time: "2026-04-14T08:00:00Z" },
    { type: "DEPARTURE", port: "MALAGA", name: "Malaga, Spain", time: "2026-04-14T18:00:00Z" },

    { type: "SEA_DAY", date: "2026-04-15", name: "At Sea" },

    { type: "ARRIVAL", port: "BARCELONA", name: "Barcelona, Spain", time: "2026-04-16T05:00:00Z" }
];
"""

with open(filepath_it, "w") as f:
    f.write(new_itinerary)

print("Updates complete")
