import fs from 'fs';
import path from 'path';

const filesToUpdate = [
  'src/App.tsx',
  'src/components/MatchesSection.tsx',
  'src/components/PredictionGame.tsx',
  'src/components/AuthModal.tsx',
  'src/components/UsernameModal.tsx',
  'src/components/UsernameSetup.tsx'
];

const fixes = {
  'bg-aurora-800urora-': 'bg-aurora-',
  'bg-aurora-800byss-': 'bg-abyss-',
  'aurora-teal': 'aurora-500',
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
