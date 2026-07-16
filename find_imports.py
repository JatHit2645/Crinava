import os
import re

files_to_check = ['src/App.tsx']
for file in files_to_check:
    if os.path.exists(file):
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            imports = re.findall(r'^import\s+\{([^}]+)\}\s+from\s+[\'\"]([^\'\"]+)[\'\"];?', content, re.MULTILINE)
            for imp_names, imp_path in imports:
                if any(x in imp_names for x in ['MatchesSection', 'PredictionGame', 'VerdictTool', 'AdminControlCenter', 'PlayerProfile']):
                    print(f'{file}: {imp_names.strip()} from {imp_path}')
