import fs from 'fs';

const replacements: Record<string, string> = {
  'bg-cmd-bg': 'bg-background-base',
  'bg-cmd-surface-hover': 'bg-surface-hover',
  'bg-cmd-surface': 'bg-surface backdrop-blur-md',
  'text-cmd-text-primary': 'text-foreground',
  'text-cmd-text-secondary': 'text-foreground-muted',
  'text-cmd-text-muted': 'text-foreground-subtle',
  'border-cmd-border-light': 'border-border-hover',
  'border-cmd-border': 'border-border-default',
  'text-cmd-cyan': 'text-accent',
  'bg-cmd-cyan': 'bg-accent',
  'border-cmd-cyan': 'border-accent',
  'text-cmd-yellow': 'text-accent-bright',
  'bg-cmd-yellow': 'bg-accent-bright',
  'border-cmd-yellow': 'border-accent',
  'text-cmd-crimson': 'text-status-error',
  'bg-cmd-crimson': 'bg-status-error',
  'border-cmd-crimson': 'border-status-error',
  'shadow-cmd-glow-gold': 'shadow-glow',
  'shadow-cmd-glow': 'shadow-glow',
  'shadow-cmd-card': 'shadow-card',
  'cmd-card': 'card-base',
  'font-display': 'font-sans tracking-tight',
};

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [oldClass, newClass] of Object.entries(replacements)) {
    const regex = new RegExp(oldClass, 'g');
    content = content.replace(regex, newClass);
  }
  fs.writeFileSync(filePath, content);
}

processFile('src/App.tsx');
processFile('src/components/PlayerEnrichmentButton.tsx');
console.log('Refactoring complete.');
