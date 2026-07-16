import re

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Look for duplicate raffleHistory
# It was likely declared as const [raffleHistory] = useState(...) and the regex in refactor_app_state.py didn't match it because there is no setter!
# The user's code might have `const [raffleHistory] = useState<RaffleHistory[]>([ ... ])`
pattern = r'\s*const\s+\[\s*raffleHistory\s*\]\s*=\s*(?:React\.)?useState(?:<[^>]*>)?\([^)]*\);?'

# Wait, if it has a multi-line initial value, it won't match `[^)]*`. Let's just use re.sub with re.DOTALL but carefully.
# We can just remove the whole block.
# Let's see the text around line 1194.
import sys
# It's safer to just replace `const [raffleHistory]` with `// removed raffleHistory`
# But let's find the exact string.
matches = re.finditer(r'const\s+\[raffleHistory\]\s*=\s*useState', content)
for m in matches:
    start_idx = m.start()
    end_idx = content.find(']);', start_idx) + 3
    if end_idx > start_idx + 3:
        content = content[:start_idx] + "/* removed local raffleHistory */\n" + content[end_idx:]
        break # only do it once if multiple, or loop. Let's loop.

matches = re.finditer(r'const\s+\[raffleHistory\]\s*=\s*useState', content)
for m in matches:
    start_idx = m.start()
    end_idx = content.find(']);', start_idx) + 3
    if end_idx > start_idx + 3:
        content = content[:start_idx] + "/* removed local raffleHistory */\n" + content[end_idx:]


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed raffleHistory redeclaration.")
