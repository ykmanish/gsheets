require('dotenv').config();
const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });
const sheetId = '1YcFUaOMnWk4HpYEF3VNIvruwR5f0PBNJ';

sheets.spreadsheets.get({ spreadsheetId: sheetId }).then(res => {
  const titles = res.data.sheets.map(s => s.properties.title);
  console.log('Tabs:', titles);
  
  if (titles.length > 0) {
    const rangeStr = "'" + titles[0].replace(/'/g, "''") + "'!A1:M30";
    return sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: rangeStr });
  }
}).then(res => {
  if (res) console.log('First tab preview:', JSON.stringify(res.data.values, null, 2));
}).catch(console.error);
