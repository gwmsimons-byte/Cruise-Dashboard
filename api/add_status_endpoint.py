with open("main.py", "r") as f:
    content = f.read()

endpoint = """
@app.get("/api/test-status")
def test_status():
    return {"status": "ok", "message": "FastAPI is reachable on Koyeb!"}
"""

if "@app.get(\"/api/test-status\")" not in content:
    idx = content.find('@app.get("/api/waves")')
    if idx != -1:
        # Insert before /api/waves
        new_content = content[:idx] + endpoint + "\n\n" + content[idx:]
        with open("main.py", "w") as f:
            f.write(new_content)
        print("Diagnostic endpoint added")
    else:
        print("Could not find waves endpoint to insert before")
else:
    print("Endpoint already present")
