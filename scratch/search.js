const fs = require('fs');

function search(file, query) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('\u0000')) {
    content = fs.readFileSync(file, 'utf16le');
  }
  const lines = content.split(/\r?\n/);
  console.log(`=== Searching in ${file} for "${query}" ===`);
  let count = 0;
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
      console.log(`${index + 1}: ${line.trim()}`);
      count++;
    }
  });
  console.log(`Found ${count} matches.\n`);
}

search('Frontend/react-crud/src/pages/AttendancePage.js', 'actres');
