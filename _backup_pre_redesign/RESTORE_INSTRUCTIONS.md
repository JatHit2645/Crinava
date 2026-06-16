# 🛡️ Crinava UI Redesign - Backup & Restore

## How to Restore Original UI

If you need to revert the Celestial Organic redesign, run these commands:

```powershell
cd C:\Users\hp\.gemini\antigravity\scratch\Crinava-main

# Restore index.css
copy "_backup_pre_redesign\index.css" "src\index.css" /Y

# Restore App.tsx
copy "_backup_pre_redesign\App.tsx" "src\App.tsx" /Y

# Restore MatchesSection.tsx
copy "_backup_pre_redesign\MatchesSection.tsx" "src\components\MatchesSection.tsx" /Y

# Restore index.html
copy "_backup_pre_redesign\index.html" "index.html" /Y
```

Then restart the dev server with `npm run dev`.

## Files Backed Up
- `index.css` - Original Tailwind/CSS design tokens
- `App.tsx` - Full application with original UI layout
- `MatchesSection.tsx` - Live match dashboard component
- `index.html` - Entry HTML file
