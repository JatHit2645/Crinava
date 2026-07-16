with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'mouse' in line.lower() or 'cursor' in line.lower() or 'pointer' in line.lower():
        print(f"{i+1}: {line.strip()}")
