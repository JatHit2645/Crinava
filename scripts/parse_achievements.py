import re
import json

def parse():
    with open(r'C:\Users\hp\.gemini\antigravity\scratch\achievements_manifest.md', 'r', encoding='utf-8') as f:
        content = f.read()
    
    categories = re.split(r'## Category \w: (.*)', content)[1:]
    
    output_ts = """export type AchievementStage = 1 | 2 | 3 | 4 | 5;

export interface AchievementThreshold {
  id: string;
  name: string;
  category: string;
  description: string;
  thresholds: [string, string, string, string, string]; // Now strings since they are text like "5 votes"
}

export const ACHIEVEMENTS_CONFIG: Record<string, AchievementThreshold> = {
"""
    
    for i in range(0, len(categories), 2):
        category_name = categories[i].strip()
        cat_content = categories[i+1]
        
        badges = re.split(r'### \d+\. (.*?)\n', cat_content)[1:]
        for j in range(0, len(badges), 2):
            badge_name_full = badges[j].strip()
            # Extract actual name (e.g., "Rope Burner (Activity Badge)" -> "Rope Burner")
            name_match = re.match(r'(.*?)(?:\s+\(.*?\))?$', badge_name_full)
            badge_name = name_match.group(1).strip() if name_match else badge_name_full
            
            badge_id = badge_name.lower().replace(" ", "_").replace("'", "").replace("-", "_")
            
            b_content = badges[j+1]
            desc_match = re.search(r'\* \*\*Description:\*\* (.*)', b_content)
            description = desc_match.group(1).strip().replace('"', '\\"') if desc_match else ""
            
            t1 = re.search(r'\* \*\*Stage 1 \(Bronze\):\*\* (.*)', b_content).group(1).strip().replace('"', '\\"')
            t2 = re.search(r'\* \*\*Stage 2 \(Silver\):\*\* (.*)', b_content).group(1).strip().replace('"', '\\"')
            t3 = re.search(r'\* \*\*Stage 3 \(Gold\):\*\* (.*)', b_content).group(1).strip().replace('"', '\\"')
            t4 = re.search(r'\* \*\*Stage 4 \(Platinum\):\*\* (.*)', b_content).group(1).strip().replace('"', '\\"')
            t5 = re.search(r'\* \*\*Stage 5 \(Onyx\):\*\* (.*)', b_content).group(1).strip().replace('"', '\\"')
            
            output_ts += f"""  {badge_id}: {{
    id: "{badge_id}",
    name: "{badge_name}",
    category: "{category_name}",
    description: "{description}",
    thresholds: ["{t1}", "{t2}", "{t3}", "{t4}", "{t5}"],
  }},
"""
    
    output_ts += """};

export function calculateCurrentStage(achievementId: string, currentStat: number): number {
  // Logic left to UI if using strings, or keep a mock function here.
  return 0; 
}
"""

    with open(r'C:\Users\hp\.gemini\antigravity\scratch\Crinava-main\src\lib\achievementsConfig.ts', 'w', encoding='utf-8') as f:
        f.write(output_ts)
        
if __name__ == '__main__':
    parse()
