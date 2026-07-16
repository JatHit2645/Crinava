import re
import os

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'const\s+\[(.*?)\]\s*=\s*(?:React\.)?useState(?:<[^>]*>)?\(([\s\S]*?)\)(?=;|const|return|\n)'
matches = re.finditer(pattern, content)

states = []
for match in matches:
    vars_str = match.group(1).strip()
    init_val = match.group(2).strip()
    if ',' in vars_str:
        var_name = vars_str.split(',')[0].strip()
        setter_name = vars_str.split(',')[1].strip()
    else:
        var_name = vars_str
        setter_name = ""
    states.append(f"{var_name}: {init_val.split(chr(10))[0][:30]}")

plan = f"""# Implementation Plan: Global State Migration

## Goal
Execute Phase 1 of system remediation by migrating all localized `useState` hooks from the `App.tsx` monolith into a globally synchronized Zustand store with persistence, eliminating prop drilling and maintaining type safety.

## User Review Required
Please review the list of state hooks identified for migration and the proposed store architecture. Are there any specific state properties you want to EXCLUDE from the global store (e.g. temporary UI hover states)?

## Proposed Changes

### 1. src/store/globalStore.ts [NEW]
Create a fully-typed Zustand store implementing `persist` middleware.
It will include the following state variables mapped from `App.tsx`:
"""
for i, state in enumerate(states):
    plan += f"- {i+1}. {state}\n"

plan += """
### 2. src/App.tsx [MODIFY]
- **Strip** all the above `useState` declarations.
- **Import** and invoke `useGlobalStore` to access these states.
- **Remove** prop-drilling from child components instantiated in `App.tsx` (e.g. `UsernameSetup`, `MatchesSection`, etc. will also be updated to use the store if they were receiving props, but the prompt says focus exclusively on `App.tsx` state migration - wait, "Ensure that every sub-component and surface... reads and mutates state directly from this unified source").
- Update child components passed from `App.tsx` to read directly from Zustand.

## Verification Plan

### Automated Tests
- Run `tsc --noEmit` from the internal terminal to programmatically verify that all variable references, type interfaces, and state mutations match perfectly across the refactored files.

### Manual Verification
- Generate an Antigravity Artifact card summarizing the exact hook-to-store mapping and confirming clean TypeScript compilation.
"""

with open("C:/Users/hp/.gemini/antigravity/brain/e82d1e2e-f840-4816-a8e1-74d7770c40cf/implementation_plan.md", "w", encoding='utf-8') as f:
    f.write(plan)
print(f"Generated plan with {len(states)} states.")
