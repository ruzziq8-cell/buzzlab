
const https = require('https');

// Known DDG IPs (Microsoft Azure)
// 52.149.246.39
// 40.114.177.156
// 20.191.45.212
const REAL_IP = '52.149.246.39'; 

async function testBypass() {
    console.log(`Testing DDG Bypass with IP ${REAL_IP}...`);
    
    const options = {
        hostname: 'duckduckgo.com',
        port: 443,
        path: '/duckchat/v1/status',
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Host': 'duckduckgo.com',
            'x-api-key': 'duckduckgo-staging-api-key'
        },
        lookup: (hostname, opts, cb) => {
            console.log(`[DNS] Forcing ${hostname} -> ${REAL_IP}`);
            cb(null, REAL_IP, 4);
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log('Headers:', res.headers);
            
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Body:', data);
                if (res.headers['x-vqd-4']) {
                    console.log('✅ SUCCESS! Got VQD:', res.headers['x-vqd-4']);
                } else {
                    console.log('❌ Failed to get VQD');
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error('Request Error:', e);
            resolve();
        });

        req.end();
    });
}

testBypass();
