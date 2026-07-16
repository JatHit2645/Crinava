import re
import os

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# More robust pattern for useState
pattern = r'const\s+\[(.*?)\]\s*=\s*(?:React\.)?useState(?:<.*?>)?\((.*?)\)'
states = []
for match in re.finditer(pattern, content):
    vars_str = match.group(1).strip()
    initial_val = match.group(2).strip()
    
    if ',' in vars_str:
        state_var, setter = [v.strip() for v in vars_str.split(',', 1)]
    else:
        state_var, setter = vars_str, ""
        
    states.append({
        'var': state_var,
        'setter': setter,
        'init': initial_val
    })

print(f"Total states found: {len(states)}")
for i, s in enumerate(states):
    print(f"{i+1}. {s['var']}")
