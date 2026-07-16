import os
import re

def fix_shorthand(content):
    # standard h-x w-x -> size-x
    """Normalize paired width/height utility classes into a single size shorthand.
    Parameters:
        - content (str): String containing utility class markup to normalize.
    Returns:
        - str: Updated string with matching h/w or w/h pairs replaced by size shorthand."""
    content = re.sub(r'\bh-([a-zA-Z0-9.\[\]-]+)\s+w-\1\b', r'size-\1', content)
    content = re.sub(r'\bw-([a-zA-Z0-9.\[\]-]+)\s+h-\1\b', r'size-\1', content)
    
    # prefixed variants (like hover:w-4 hover:h-4)
    content = re.sub(r'([a-zA-Z0-9\[\]&:-]+):h-([a-zA-Z0-9.\[\]-]+)\s+\1:w-\2\b', r'\1:size-\2', content)
    content = re.sub(r'([a-zA-Z0-9\[\]&:-]+):w-([a-zA-Z0-9.\[\]-]+)\s+\1:h-\2\b', r'\1:size-\2', content)
    return content

directory = r'C:\Users\hp\.gemini\antigravity\scratch\Crinava-main\src'
count = 0
for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            new_content = fix_shorthand(content)
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                count += 1
                print(f"Fixed Tailwind shorthand in {file}")

print(f"Total files updated: {count}")
