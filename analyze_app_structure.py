import re
import os

filepath = "src/App.tsx"
if not os.path.exists(filepath):
    print("App.tsx not found")
    exit(0)
    
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

components = []
mock_data = []

current_block = ""
current_block_name = ""
is_component = False

for i, line in enumerate(lines):
    if line.startswith("const ") and " = ()" in line or " = {" in line or " = [" in line or "function " in line:
        match = re.match(r'(?:export\s+)?(?:const|function)\s+([A-Z]\w+)', line)
        if match:
            components.append(match.group(1))
        else:
            match_data = re.match(r'(?:export\s+)?const\s+([a-z]\w+)\s*=\s*\[', line)
            if match_data:
                mock_data.append(match_data.group(1))

print(f"Total Lines: {len(lines)}")
print("Components defined in App.tsx:")
print(components)
print("Possible Mock Data arrays in App.tsx:")
print(mock_data)

# Print largest chunks by line count
# Let's write a simple script to find function lengths
lengths = {}
current_func = None
start_line = 0
for i, line in enumerate(lines):
    match = re.match(r'(?:export\s+)?(?:const|function)\s+([A-Za-z0-9_]+)\s*=', line)
    if match:
        if current_func:
            lengths[current_func] = i - start_line
        current_func = match.group(1)
        start_line = i

if current_func:
    lengths[current_func] = len(lines) - start_line

sorted_lengths = sorted(lengths.items(), key=lambda x: x[1], reverse=True)
print("\nLargest blocks in App.tsx:")
for name, length in sorted_lengths[:10]:
    print(f"- {name}: {length} lines")
