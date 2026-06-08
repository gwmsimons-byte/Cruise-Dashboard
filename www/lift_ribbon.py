import os

filepath = "/Users/geertsimons/Library/Mobile Documents/com~apple~CloudDocs/Projects/cruise-dashboard/www/style.css"

with open(filepath, "r") as f:
    content = f.read()

target = """.ribbon-container {
    position: relative;
    height: 36px;
    margin-bottom: 5px;
}"""

# Increase margin-bottom to pull it up with standard buffer spacing
new_impl = """.ribbon-container {
    position: relative;
    height: 36px;
    margin-bottom: 25px; /* Verhoogd om het lint hoger in het beeld te trekken */
}"""

if target in content:
    content = content.replace(target, new_impl)
    with open(filepath, "w") as f:
        f.write(content)
    print("Lint successfully lifted upwards")
else:
    print("Could not find .ribbon-container style definition")
