import re
with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
    matches = re.findall(r'customIcon:\s*["\']([^"\']+)["\']', content)
    print("Found custom icons:", set(matches))
