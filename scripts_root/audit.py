import os
import re
import json
from collections import defaultdict

WORKSPACE_DIR = r"c:/Users/hp/.gemini/antigravity/scratch/Crinava-main"
SRC_DIR = os.path.join(WORKSPACE_DIR, "src")

def analyze_dependencies():
    files_to_analyze = []
    
    # Collect all ts, tsx, py, js files
    for root, dirs, files in os.walk(WORKSPACE_DIR):
        if "node_modules" in root or ".git" in root or "dist" in root or "__pycache__" in root:
            continue
        for file in files:
            if file.endswith(('.ts', '.tsx', '.py', '.js', '.jsx')):
                files_to_analyze.append(os.path.join(root, file))
                
    dependencies = defaultdict(list)
    provided_exports = defaultdict(list)
    
    import_pattern = re.compile(r'import\s+.*?\s+from\s+[\'"](.*?)[\'"]')
    require_pattern = re.compile(r'require\([\'"](.*?)[\'"]\)')
    py_import_pattern = re.compile(r'^\s*(?:import|from)\s+([a-zA-Z0-9_\.]+)', re.MULTILINE)
    
    for filepath in files_to_analyze:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if filepath.endswith('.py'):
                imports = py_import_pattern.findall(content)
                dependencies[filepath].extend(imports)
            else:
                imports = import_pattern.findall(content)
                requires = require_pattern.findall(content)
                dependencies[filepath].extend(imports + requires)
                
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            
    with open(os.path.join(WORKSPACE_DIR, 'dependency_report.json'), 'w') as f:
        json.dump(dependencies, f, indent=2)

if __name__ == "__main__":
    analyze_dependencies()
    print("Dependency analysis complete.")
