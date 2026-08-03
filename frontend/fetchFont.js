const https = require('https');
const fs = require('fs');

https.get('https://github.com/vercel/geist-font/raw/main/packages/next/fonts/geist-sans/Geist-Regular.ttf', (res) => {
  if (res.statusCode === 301 || res.statusCode === 302) {
    https.get(res.headers.location, (res2) => {
      processDownload(res2);
    });
  } else {
    processDownload(res);
  }
}).on('error', console.error);

function processDownload(res) {
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const base64 = buffer.toString('base64');
    fs.mkdirSync('src/lib', { recursive: true });
    fs.writeFileSync('src/lib/geistFont.js', 'export const GeistRegularBase64 = "' + base64 + '";\n');
    console.log('Done downloading Geist font. Base64 length:', base64.length);
  });
}
