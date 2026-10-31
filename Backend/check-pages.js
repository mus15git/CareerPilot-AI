const fs = require('fs');

const dataBuffer = fs.readFileSync('test.pdf');
const content = dataBuffer.toString('binary');
const matches = content.match(/\/Type\s*\/Page\b/g);
console.log('Number of Pages:', matches ? matches.length : 0);
