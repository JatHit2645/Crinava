const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/\[aurora-(\d+)\]/g, 'aurora-$1');

fs.writeFileSync('src/App.tsx', content);
