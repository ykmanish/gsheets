const fs = require('fs');
const base64 = fs.readFileSync('src/app/font/satre.ttf').toString('base64');
fs.writeFileSync('src/lib/geistFont.js', 'export const GeistRegularBase64 = "' + base64 + '";\n');
console.log('Done converting satre.ttf to base64. Length:', base64.length);
