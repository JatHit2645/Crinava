with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import * as Lucide from "lucide-react";\n', '')
content = content.replace('const LucideIcon = customIcon ? (Lucide as any)[customIcon] : null;', 'const LucideIcon = null; /* Removed dynamic lucide import to enable tree shaking */')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Tree shaking enabled for lucide-react.")
