with open("main.py", "r") as f:
    content = f.read()

target = """@app.get("/api/test-status")
def test_status():
    return {"status": "ok", "message": "FastAPI is reachable on Koyeb!"}"""

new_impl = """@app.get("/api/test-status")
def test_status():
    import os
    try:
        # Check folders to verify static file locations
        cwd = os.getcwd()
        api_dir = os.listdir(".")
        app_dir = os.listdir("..") if os.path.exists("..") else []
        www_dir = os.listdir("../www") if os.path.exists("../www") else []
        
        static_dir_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "www")
        static_exists = os.path.exists(static_dir_path)
        index_exists = os.path.exists(os.path.join(static_dir_path, "index.html"))
        
        return {
            "status": "ok",
            "message": "FastAPI is reachable!",
            "cwd": cwd,
            "api_dir": api_dir,
            "app_dir": app_dir,
            "www_dir": www_dir,
            "static_dir_path": static_dir_path,
            "static_exists": static_exists,
            "index_exists": index_exists
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}"""

if target in content:
    content = content.replace(target, new_impl)
    with open("main.py", "w") as f:
        f.write(content)
    print("Enhanced diagnostic endpoint")
else:
    # If not found, look for similar or try-again
    print("Target endpoint string not found in main.py")
