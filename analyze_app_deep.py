import re
import os

filepath = "src/App.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find function declarations
matches = re.finditer(r'(?:export\s+)?(?:default\s+)?function\s+([A-Za-z0-9_]+)\s*\(', content)
for match in matches:
    print(f"Found function: {match.group(1)}")

# And arrow functions
matches2 = re.finditer(r'(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\(.*?\)\s*=>', content)
for match in matches2:
    print(f"Found component: {match.group(1)}")

# How big is function App?
app_start = content.find("function App()")
if app_start == -1:
    app_start = content.find("const App =")

if app_start != -1:
    print(f"App component starts at index: {app_start}")
    
# Let's see if there are giant arrays/objects defined inside App
app_content = content[app_start:]
mock_matches = re.finditer(r'const\s+([a-zA-Z0-9_]+)\s*=\s*\[', app_content)
for m in mock_matches:
    # Just print the first 20 names to avoid too much output
    print(f"Inner array: {m.group(1)}")
