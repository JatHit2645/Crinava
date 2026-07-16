import os
import re

backend_dir = r"c:/Users/hp/.gemini/antigravity/scratch/Crinava-main/backend"

# Map old module names to their new package paths
module_map = {
    "engine": "backend.services.engine",
    "crinava_worker": "backend.services.crinava_worker",
    "worker": "backend.services.worker",
    "logger": "backend.utils.logger",
    "hub": "backend.utils.hub",
    "stealth": "backend.utils.stealth",
    "cors_config": "backend.api.cors_config"
}

def fix_imports():
    for root, dirs, files in os.walk(backend_dir):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = content
                for old_mod, new_mod in module_map.items():
                    # Replace `from module import ...`
                    new_content = re.sub(rf"^from {old_mod} import", f"from {new_mod} import", new_content, flags=re.MULTILINE)
                    # Replace `import module`
                    new_content = re.sub(rf"^import {old_mod}(\s|$)", f"import {new_mod}\\1", new_content, flags=re.MULTILINE)
                    
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Fixed imports in {filepath}")

if __name__ == "__main__":
    fix_imports()
