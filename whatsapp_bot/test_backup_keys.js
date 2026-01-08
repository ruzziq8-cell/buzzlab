const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { processWithAI } = require('./ai_service');

async function testCohere() {
    console.log("Testing Cohere Backup...");
    const COHERE_KEY = process.env.COHERE_API_KEY;
    
    try {
        console.log("Sending request to Cohere...");
        const response = await fetch("https://api.cohere.com/v1/chat", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${COHERE_KEY}`
            },
            body: JSON.stringify({
                message: "Halo, tes koneksi. Jawab 'OK' saja.",
                model: "command-r-08-2024"
            }),
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            console.error("Cohere Error:", response.status, await response.text());
        } else {
            const data = await response.json();
            console.log("✅ Cohere Success:", data.text);
        }
    } catch (e) {
        console.error("Cohere Failed:", e.message);
    }
}

async function testHF() {
    console.log("\nTesting Hugging Face Backup...");
    const HF_TOKEN = process.env.HF_TOKEN;
    const model = "google/gemma-1.1-7b-it"; // Very standard model

    try {
        console.log(`Sending request to Hugging Face (${model})...`);
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`
            },
            body: JSON.stringify({
                inputs: "Halo",
                parameters: { max_new_tokens: 50 }
            }),
            signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) {
            console.error("HF Error:", await response.text());
        } else {
            const data = await response.json();
            // HF inference API response structure can vary, sometimes it's an array, sometimes object
            console.log("✅ HF Success:", JSON.stringify(data));
        }
    } catch (e) {
        console.error("HF Failed:", e.message);
    }
}

async function runTests() {
    await testCohere();
    await testHF();
}

runTests();
