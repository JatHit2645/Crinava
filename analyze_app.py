import ast
import json
import re

filepath = "src/App.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Check for lazy loading
print("Uses React.lazy:", "React.lazy" in content or "lazy(" in content)

# Look for large arrays/objects (mock data)
matches = re.finditer(r'(const \w+\s*=\s*\[.*?\n\];)', content, re.DOTALL)
large_vars = []
for match in matches:
    var_block = match.group(1)
    if len(var_block) > 2000:
        var_name = re.search(r'const (\w+)\s*=', var_block).group(1)
        large_vars.append((var_name, len(var_block)))

matches_obj = re.finditer(r'(const \w+\s*=\s*\{.*?\n\};)', content, re.DOTALL)
for match in matches_obj:
    var_block = match.group(1)
    if len(var_block) > 2000:
        var_name = re.search(r'const (\w+)\s*=', var_block).group(1)
        large_vars.append((var_name, len(var_block)))

print("Large mock data variables in App.tsx:")
for var_name, size in large_vars:
    print(f"- {var_name}: {size} bytes")

# Check current Zustand usage
print("Uses Zustand:", "zustand" in content)
