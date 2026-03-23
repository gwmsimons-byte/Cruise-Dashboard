with open("app.js", "r") as f:
    content = f.read()

target = 'icon: "icons/icon-192x192.png"'
replacement = 'icon: "icons/icon-192.webp"'

if target in content:
    content = content.replace(target, replacement)
    with open("app.js", "w") as f:
        f.write(content)
    print("Updated icons in app.js")
else:
    print("Target string not found in app.js")
