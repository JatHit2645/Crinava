import re

def fix_zustand_setters(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace the interface: setVar: (val: Type) => void
    # with setVar: (val: Type | ((prev: Type) => Type)) => void
    pattern_iface = r'(set[A-Za-z0-9_]+)\s*:\s*\(\s*val\s*:\s*([^)]+)\s*\)\s*=>\s*void'
    def repl_iface(match):
        setter = match.group(1)
        typ = match.group(2)
        return f"{setter}: (val: {typ} | ((prev: {typ}) => {typ})) => void"
        
    content = re.sub(pattern_iface, repl_iface, content)
    
    # Replace the implementation: setVar: (val) => set({ var: val })
    # with setVar: (val) => set((state) => ({ var: typeof val === 'function' ? val(state.var) : val }))
    pattern_impl = r'(set[A-Za-z0-9_]+)\s*:\s*\(\s*val\s*\)\s*=>\s*set\(\s*\{\s*([A-Za-z0-9_]+)\s*:\s*val\s*\}\s*\)'
    def repl_impl(match):
        setter = match.group(1)
        var_name = match.group(2)
        return f"{setter}: (val) => set((state) => ({{ {var_name}: typeof val === 'function' ? val(state.{var_name}) : val }}))"
        
    content = re.sub(pattern_impl, repl_impl, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_zustand_setters('src/store/globalStore.ts')
fix_zustand_setters('src/store/uiStore.ts')
print("Fixed Zustand setters to support functional updates.")
