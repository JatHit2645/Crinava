import re

def refactor_app():
    filepath = 'src/App.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Insert imports if not exist
    if "import { useGlobalStore }" not in content:
        import_stmt = 'import { useGlobalStore } from "./store/globalStore";\nimport { useUIStore } from "./store/uiStore";\n'
        # find last import
        last_import = content.rfind("import ")
        if last_import != -1:
            end_of_last = content.find('\n', last_import)
            content = content[:end_of_last+1] + import_stmt + content[end_of_last+1:]
        else:
            content = import_stmt + content

    global_states = [
        "coinBalance", "cricketIQ", "matches", "prediction", "profile", "session",
        "activeTab", "isAdminMode", "raffleTickets", "notifications", "verdict",
        "blogPosts", "raffleHistory", "badges", "debates", "debateMessages",
        "activeDebateChat", "momentumData", "careerData", "careerPlayer",
        "selectedSmartXI", "selectedMedal", "selectedStage", "selectedMatch",
        "raffleQuantity", "isSubscribed"
    ]

    ui_states = [
        "showAuthModal", "showUsernameModal", "isRaffleModalOpen", "showSideMenu",
        "showIQ", "showNotifications", "showCareerInfo", "showProInfo",
        "showBadgesModal", "showPredictionGame", "loading", "error",
        "isProfileLoading", "isMatchesContext"
    ]
    
    # We will replace the useState declarations with empty string or comment,
    # and then insert the Zustand hook calls right after 'export default function App() {'
    
    # Replace the declarations
    for var in global_states + ui_states:
        # e.g., const [coinBalance, setCoinBalance] = useState<number>(0);
        # We need a robust regex to remove it entirely
        pattern = r'\s*const\s+\[\s*' + var + r'\s*,\s*set' + var[0].upper() + var[1:] + r'\s*\]\s*=\s*(?:React\.)?useState(?:<[^>]*>)?\([^)]*\);?'
        content = re.sub(pattern, '', content)

    # Now add the Zustand hook calls at the beginning of function App() {
    app_start = re.search(r'export default function App\(\)\s*\{', content)
    if app_start:
        idx = app_start.end()
        global_vars_str = ", ".join(global_states + ["set" + v[0].upper() + v[1:] for v in global_states])
        ui_vars_str = ", ".join(ui_states + ["set" + v[0].upper() + v[1:] for v in ui_states])
        
        hook_calls = f"""
  const {{ {global_vars_str} }} = useGlobalStore();
  const {{ {ui_vars_str} }} = useUIStore();
"""
        content = content[:idx] + hook_calls + content[idx:]
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Refactoring applied to App.tsx.")

if __name__ == "__main__":
    refactor_app()
