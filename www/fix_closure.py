import os

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/www/app.js"

with open(filepath, "r") as f:
    content = f.read()

target = """        card.onclick = (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            setManualTarget(index);
        };"""

new_impl = """        const currentIndex = index; // Fix closure bug
        card.onclick = (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            setManualTarget(currentIndex);
        };"""

if target in content:
    content = content.replace(target, new_impl)
    with open(filepath, "w") as f:
        f.write(content)
    print("Fixed closure in card.onclick")
else:
    print("Target string not found for closure fix")
