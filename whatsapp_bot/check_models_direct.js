const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const KEYS = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2
].filter(Boolean);

async function checkKey(key, index) {
    console.log(`\nTesting Gemini Key ${index + 1}...`);
    // Menggunakan endpoint generateContent langsung untuk tes fungsional
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Tes koneksi. Jawab 'OK' saja." }] }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error(`❌ Key ${index + 1} Error:`, data.error?.message || data);
        } else {
            console.log(`✅ Key ${index + 1} Success! Response:`, data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
        }
    } catch (error) {
        console.error(`❌ Key ${index + 1} Network Error:`, error.message);
    }
}

async function runTests() {
    console.log("=== GEMINI API TEST ===");
    if (KEYS.length === 0) {
        console.error("No Gemini keys found in .env!");
        return;
    }
    
    for (let i = 0; i < KEYS.length; i++) {
        await checkKey(KEYS[i], i);
    }
}

runTests();
