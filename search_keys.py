import os
import re

found = False
for root, _, files in os.walk('src'):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as file:
                content = file.read()
                # find occurrences of apiKey being set to a hardcoded string
                matches = re.finditer(r'apiKey:\s*([\'"`])([A-Za-z0-9_-]+)\1', content)
                for match in matches:
                    print(f'Found hardcoded key in {filepath}: {match.group(2)[:10]}...')
                    found = True

if not found:
    print("No hardcoded keys found. Let's look for any GoogleGenAI initialization.")
    for root, _, files in os.walk('src'):
        for f in files:
            if f.endswith('.tsx') or f.endswith('.ts'):
                filepath = os.path.join(root, f)
                with open(filepath, 'r', encoding='utf-8') as file:
                    content = file.read()
                    if 'GoogleGenAI' in content:
                        print(f"GoogleGenAI found in {filepath}")
