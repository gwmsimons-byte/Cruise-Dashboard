# Single Python Script to fix style.css
filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/www/style.css"

with open(filepath, "r") as f:
    content = f.read()

# 1. Update .hud-container
hud_target = """.hud-container {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--safe-top) 16px var(--safe-bottom) 16px;
    z-index: 2;
    pointer-events: none;
}"""

hud_replacement = """.hud-container {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--safe-top) 16px var(--safe-bottom) 16px;
    z-index: 2;
    pointer-events: none;
    box-sizing: border-box; /* Fix: include padding in height calculation */
}"""

if hud_target in content:
    content = content.replace(hud_target, hud_replacement)
    print("Fixed .hud-container box-sizing")
else:
    print("Could not find .hud-container definition")

# 2. Update .wave-active
wave_target = """.map-action-btn.wave-active {
    background: rgba(0, 212, 255, 0.25);
    border-color: var(--accent-color);
    box-shadow: 0 0 15px rgba(0, 212, 255, 0.6);
    color: white;
}"""

wave_replacement = """.map-action-btn.wave-active {
    border-color: var(--accent-color);
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
    color: var(--accent-color);
}"""

if wave_target in content:
    content = content.replace(wave_target, wave_replacement)
    print("Fixed .wave-active style")
else:
    print("Could not find .wave-active definition")

with open(filepath, "w") as f:
    f.write(content)

print("Modification complete")
