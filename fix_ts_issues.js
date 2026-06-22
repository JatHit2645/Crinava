const fs = require('fs');
const path = require('path');

/**
 * Replaces matched text in a file and writes the file back only if changes were made.
 * @example
 * replaceInFile('example.txt', [{ search: /foo/g, replace: 'bar' }])
 * undefined
 * @param {string} filePath - Path to the file that will be read and potentially updated.
 * @param {Array<{search: string|RegExp, replace: string}>} replacements - List of search and replace pairs to apply to the file content.
 * @returns {void} Returns nothing.
 **/
function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  
  for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

// 1. Array/Object Destructuring
replaceInFile('scripts/test_scorecard.ts', [
  { search: /const format = match_data\.format;/g, replace: 'const { format } = match_data;' },
  { search: /const matches = data\.matches;/g, replace: 'const { matches } = data;' },
  { search: /const data = array\[0\];/g, replace: 'const [data] = array;' },
]);

replaceInFile('src/pages/PlayerProfile.tsx', [
  { search: /const data = array\[0\];/g, replace: 'const [data] = array;' },
  { search: /const career = data\.career;/g, replace: 'const { career } = data;' },
]);

replaceInFile('src/scripts/check-match-names.ts', [
  { search: /const match = row\[0\];/g, replace: 'const [match] = row;' }
]);

replaceInFile('src/services/verdictService.ts', [
  { search: /const value = rawStats\[0\]\.value;/g, replace: 'const value = rawStats[0]?.value;' }, // or object destructuring if applicable
  // More generic replacements for destructuring
  { search: /const (\w+) = (\w+)\.\1;/g, replace: 'const { $1 } = $2;' },
]);

replaceInFile('src/components/MatchesSection.tsx', [
  { search: /const key = Object.keys\(dObj\)\[0\];/g, replace: 'const [key] = Object.keys(dObj);' },
  { search: /if \(view === "tournaments"\) {\s*if \(onBackToHome\) onBackToHome\(\);\s*}/g, replace: 'if (view === "tournaments" && onBackToHome) {\n      onBackToHome();\n    }' },
]);

// 2. Unary Operators (++ / --)
const tsFiles = [];
function findTsFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findTsFiles(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      tsFiles.push(fullPath);
    }
  }
}

findTsFiles('src');

for (const file of tsFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  // Replace ++
  content = content.replace(/([a-zA-Z0-9_.]+(?:\[.*?\])?)\+\+/g, '$1 += 1');
  
  // Replace --
  content = content.replace(/([a-zA-Z0-9_.]+(?:\[.*?\])?)--/g, '$1 -= 1');
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log(`Fixed unary operators in ${file}`);
  }
}

// 3. Arrow function ambiguities
replaceInFile('src/components/PredictionGame.tsx', [
  { search: /=>\s*condition \? /g, replace: '=> (condition ? ' } // basic approximation
]);

// 4. Symmetric useState
replaceInFile('src/App.tsx', [
  { search: /setMatches\(\[\]\)/g, replace: 'setMatches([])' } // placeholder
]);

console.log("Custom minor TS fixes applied.");
