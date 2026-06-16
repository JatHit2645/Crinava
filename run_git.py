import subprocess
try:
    res = subprocess.run(["git", "--version"], capture_output=True, text=True, check=True)
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)
except Exception as e:
    print("Error:", e)
