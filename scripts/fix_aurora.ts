import fs from 'fs';

const files = [
  'src/App.tsx',
  'src/components/PredictionGame.tsx',
  'src/components/AuthModal.tsx',
  'src/components/UsernameModal.tsx',
  'src/components/UsernameSetup.tsx',
  'src/components/RazorpayCheckout.tsx'
];

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace all aurora classes with cmd classes
  content = content.replace(/aurora-300\/30/g, 'cmd-cyan/30');
  content = content.replace(/aurora-300\/10/g, 'cmd-cyan/10');
  content = content.replace(/aurora-300\/20/g, 'cmd-cyan/20');
  content = content.replace(/aurora-300\/5/g, 'cmd-cyan/5');
  content = content.replace(/aurora-300\/50/g, 'cmd-cyan/50');
  content = content.replace(/aurora-500\/20/g, 'cmd-cyan/20');
  content = content.replace(/aurora-500\/10/g, 'cmd-cyan/10');
  content = content.replace(/aurora-500\/50/g, 'cmd-cyan/50');
  content = content.replace(/aurora-500\/80/g, 'cmd-cyan/80');
  content = content.replace(/aurora-700\/30/g, 'cmd-cyan/30');
  content = content.replace(/aurora-300/g, 'cmd-cyan');
  content = content.replace(/aurora-500/g, 'cmd-cyan');
  content = content.replace(/aurora-600/g, 'cmd-cyan');
  content = content.replace(/aurora-700/g, 'cmd-cyan');
  content = content.replace(/aurora-950/g, 'cmd-bg');
  content = content.replace(/aurora-100/g, 'cmd-cyan/10');
  content = content.replace(/metallic-gold/g, 'cmd-yellow');
  content = content.replace(/gold-base/g, 'cmd-yellow');
  content = content.replace(/gold-dark/g, 'cmd-yellow');
  content = content.replace(/bg-text-primary/g, 'bg-cmd-yellow');
  content = content.replace(/text-aurora-950/g, 'text-cmd-bg');

  fs.writeFileSync(filePath, content);
  console.log(`Replaced aurora classes in ${filePath}`);
});
