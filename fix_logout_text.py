with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace Terminate Session with Log Out
# Account for different line endings and potential double-spacing.
modified = content.replace("Terminate Session", "Log Out")

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(modified)

print("App.tsx logout button text updated.")
