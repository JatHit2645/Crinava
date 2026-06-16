const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/#050B14/g, 'aurora-950');
content = content.replace(/#0A1320/g, 'aurora-900');
content = content.replace(/#1A2639/g, 'aurora-800');
content = content.replace(/#2A3649/g, 'aurora-700');

fs.writeFileSync('src/App.tsx', content);
