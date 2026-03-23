with open("main.py", "r") as f:
    content = f.read()

endpoint = """
from fastapi.responses import FileResponse

@app.get("/")
def read_index():
    # Forceer directe weergave van index.html om root-resolvatie bugs te omzeilen
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "www")
    return FileResponse(os.path.join(static_dir, "index.html"))
"""

if '@app.get("/")' not in content:
    target = "static_dir = os.path.join"
    if target in content:
         new_content = content.replace(target, endpoint + "\n\n" + target)
         with open("main.py", "w") as f:
             f.write(new_content)
         print("Added explicit root endpoint for index.html")
    else:
        print("Could not find static_dir target to insert before")
else:
    print("Root endpoint already present")
