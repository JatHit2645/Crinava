import os
import re

filepath = "src/App.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add useGlobalStore import
if "import { useGlobalStore }" not in content:
    content = content.replace('import { AuthModal }', 'import { useGlobalStore } from "./store/globalStore";\nimport { AuthModal }')

# Replace states
# const [activeTab, setActiveTab] = useState<AppTab>("home");
content = re.sub(
    r'const\s+\[activeTab,\s*setActiveTab\]\s*=\s*useState(?:<[^>]+>)?\([^)]*\);',
    'const { activeTab, setActiveTab } = useGlobalStore();',
    content
)

content = re.sub(
    r'const\s+\[coinBalance,\s*setCoinBalance\]\s*=\s*useState(?:<[^>]+>)?\([^)]*\);.*?// Balance in Crinava Coins',
    'const { coinBalance, setCoinBalance } = useGlobalStore(); // Balance in Crinava Coins',
    content
)

content = re.sub(
    r'const\s+\[cricketIQ,\s*setCricketIQ\]\s*=\s*useState(?:<[^>]+>)?\([^)]*\);.*?// User\'s Cricket IQ score',
    'const { cricketIQ, setCricketIQ } = useGlobalStore(); // User\'s Cricket IQ score',
    content
)

content = re.sub(
    r'const\s+\[isSubscribed,\s*setIsSubscribed\]\s*=\s*useState(?:<[^>]+>)?\([^)]*\);',
    'const { isSubscribed, setIsSubscribed } = useGlobalStore();',
    content
)

# Remove * as Lucide import to fix bundle bloat
content = content.replace('import * as Lucide from "lucide-react";', '')
# Fix renderBadgeIcon to use only the statically imported icons
# Replace `const LucideIcon = customIcon ? (Lucide as any)[customIcon] : null;`
content = content.replace(
    'const LucideIcon = customIcon ? (Lucide as any)[customIcon] : null;',
    'const LucideIcon = null; // Removed to prevent full lucide-react bundle bloat'
)

# Replace React.lazy for Admin and Profiles
content = content.replace(
    'import { PlayerProfile } from "./pages/PlayerProfile";',
    'const PlayerProfile = React.lazy(() => import("./pages/PlayerProfile").then(module => ({ default: module.PlayerProfile })));'
)
content = content.replace(
    'import { AdminControlCenter } from "./pages/AdminControlCenter";',
    'const AdminControlCenter = React.lazy(() => import("./pages/AdminControlCenter").then(module => ({ default: module.AdminControlCenter })));'
)
content = content.replace(
    'import { MatchesSection } from "./components/MatchesSection";',
    'const MatchesSection = React.lazy(() => import("./components/MatchesSection").then(module => ({ default: module.MatchesSection })));'
)
content = content.replace(
    'import { PredictionGame } from "./components/PredictionGame";',
    'const PredictionGame = React.lazy(() => import("./components/PredictionGame").then(module => ({ default: module.PredictionGame })));'
)

# Wrap JSX references with Suspense if needed. Actually we can wrap the main content container in Suspense.
# Let's write the file
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated App.tsx state and lazy imports.")
