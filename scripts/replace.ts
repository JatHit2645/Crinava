import fs from 'fs';
import path from 'path';

const filesToUpdate = [
  'src/App.tsx',
  'src/components/MatchesSection.tsx',
  'src/components/PredictionGame.tsx',
  'src/components/AuthModal.tsx',
  'src/components/UsernameModal.tsx',
  'src/components/UsernameSetup.tsx',
  'src/components/PlayerEnrichmentButton.tsx'
];

const fixes = {
  'bg-aurora-950': 'bg-cmd-bg',
  'bg-aurora-900': 'bg-cmd-surface',
  'bg-aurora-800': 'bg-cmd-surface',
  'bg-aurora-700': 'bg-cmd-surface-hover',
  'bg-aurora-600': 'bg-cmd-border',
  'border-aurora-600': 'border-cmd-border',
  'border-aurora-500': 'border-cmd-border-light',
  'text-aurora-300': 'text-cmd-cyan',
  'text-win-green': 'text-cmd-cyan',
  'bg-win-green': 'bg-cmd-cyan',
  'border-win-green': 'border-cmd-cyan',
  'text-loss-red': 'text-cmd-crimson',
  'bg-loss-red': 'bg-cmd-crimson',
  'border-loss-red': 'border-cmd-crimson',
  'text-gold-base': 'text-cmd-yellow',
  'bg-gold-base': 'bg-cmd-yellow',
  'border-gold-base': 'border-cmd-yellow',
  'text-text-primary': 'text-cmd-text-primary',
  'text-text-body': 'text-cmd-text-secondary',
  'text-text-muted': 'text-cmd-text-muted',
  'glass-card': 'cmd-card',
  'glass-card-featured': 'cmd-card border-cmd-cyan',
  'midnight-void': 'cmd-bg',
  'aurora-dark': 'cmd-surface'
};

for (const file of filesToUpdate) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    for (const [bad, good] of Object.entries(fixes)) {
      content = content.split(bad).join(good);
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed ${file}`);
  }
}

