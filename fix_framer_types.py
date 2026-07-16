import re

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix framer-motion type errors by forcing 'any' on transitions
# e.g., transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
# We can replace transition={{ type: "spring" with transition={{ type: "spring" as any
content = re.sub(r'type:\s*"spring"', 'type: "spring" as any', content)
content = re.sub(r"type:\s*'spring'", "type: 'spring' as any", content)
content = re.sub(r'type:\s*"tween"', 'type: "tween" as any', content)
content = re.sub(r"type:\s*'tween'", "type: 'tween' as any", content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed framer-motion transition types.")
