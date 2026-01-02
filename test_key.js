const https = require('https');

const url = 'https://pyawabcoppwaaaewpkny.supabase.co/rest/v1/tasks?select=*&limit=1';
const options = {
  headers: {
    'apikey': 'sb_publishable__MNgyCgZ98xSGsWc4z1lHg_zVKdyZZc',
    'Authorization': 'Bearer sb_publishable__MNgyCgZ98xSGsWc4z1lHg_zVKdyZZc'
  }
};

console.log('Testing Supabase Connection...');
console.log('URL:', url);
console.log('Key:', options.headers.apikey);

https.get(url, options, (res) => {
  console.log('StatusCode:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Body:', data.substring(0, 500)); // Show first 500 chars
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});
