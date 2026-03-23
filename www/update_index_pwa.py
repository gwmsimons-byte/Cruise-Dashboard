with open("index.html", "r") as f:
    content = f.read()

head_close = "</head>"
pwa_tags = """    <!-- PWA / Native App Mode voor iOS en Android -->
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="manifest" href="manifest.json">
"""

if "apple-mobile-web-app-capable" not in content:
    new_content = content.replace(head_close, pwa_tags + head_close)
    with open("index.html", "w") as f:
        f.write(new_content)
    print("Added PWA tags to index.html")
else:
    print("PWA tags already present")
