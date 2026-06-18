const fs = require('fs');
const path = require('path');

function walk(dir, results = []) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== '.git' && file !== 'node_modules' && file !== 'bin' && file !== 'obj') {
        walk(fullPath, results);
      }
    } else {
      const name = file.toLowerCase();
      if (name.includes('context') || name.includes('detail') || name.includes('plan')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

console.log('Matching files:', walk('.'));
