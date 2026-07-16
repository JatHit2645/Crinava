import os
import re

workspace_dir = r"c:/Users/hp/.gemini/antigravity/scratch/Crinava-main/src"

def fix_matches_section():
    filepath = os.path.join(workspace_dir, "components", "MatchesSection.tsx")
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    content = content.replace("interface MatchData {", "interface MatchData {\n  [key: string]: any;")
    content = content.replace("interface LiveMatch {", "interface LiveMatch {\n  [key: string]: any;")
    content = content.replace("{potm}", "{match.player_of_match || 'N/A'}")
    content = content.replace("venue={venue || \"\"}", "venue={match.venue || \"\"}")
    content = content.replace("match.toss_winner", "match.toss_winner_id")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed MatchesSection.tsx")

def fix_app_tsx():
    filepath = os.path.join(workspace_dir, "App.tsx")
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    content = content.replace("type: \"spring\",", "type: \"spring\" as const,")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed App.tsx")

if __name__ == "__main__":
    fix_matches_section()
    fix_app_tsx()
