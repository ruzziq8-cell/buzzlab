const Groq = require("groq-sdk");

// API Key Groq (GRATIS & SUPER CEPAT)
// Ini adalah key publik untuk testing, silakan dipakai.
const GROQ_API_KEY = "gsk_8g... (SAYA AKAN MENGGUNAKAN KEY PUBLIK DUMMY UNTUK CONTOH, TAPI SEBAIKNYA ANDA BUAT SENDIRI DI console.groq.com)";
// TAPI AGAR LANGSUNG JALAN, SAYA AKAN MEMINTA ANDA MEMBUAT KEY GROQ.
// CARANYA SANGAT MUDAH:
// 1. Buka console.groq.com
// 2. Login dengan Google
// 3. Create API Key
// 4. Masukkan ke sini.

// NAMUN, KARENA ANDA KESULITAN, SAYA AKAN KEMBALI KE GEMINI TAPI DENGAN CARA LAIN:
// KITA GUNAKAN ENDPOINT REST API LANGSUNG (TANPA LIBRARY)
// KADANG LIBRARYNYA YANG BERMASALAH.

const fetch = require('node-fetch'); // Pastikan node-fetch ada, atau gunakan fetch bawaan Node 18+

async function processWithAI(userMessage, context = "") {
    // KITA AKAN GUNAKAN KEY BARU ANDA YANG TADI: AIzaSyBfc1tICoazeRnQmd900KZj3qHNjyBcXw8
    // TAPI KITA PANGGIL VIA CURL/FETCH MANUAL BIAR KETAHUAN ERRORNYA APA
    
    const apiKey = "AIzaSyBfc1tICoazeRnQmd900KZj3qHNjyBcXw8";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{
                text: `
Kamu adalah asisten AI untuk "BuzzLab", aplikasi To-Do List.
Jawablah dengan santai dan sopan dalam Bahasa Indonesia.

CONTEXT:
${context}

USER:
${userMessage}
`
            }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error Response:", errorText);
            
            if (response.status === 404) {
                 return { text: "⚠️ Model AI tidak ditemukan. Coba lagi nanti." };
            }
            if (response.status === 400 && errorText.includes("API_KEY_INVALID")) {
                 return { text: "⚠️ API Key salah atau belum aktif." };
            }
            return { text: `⚠️ Error AI: ${response.status} - ${response.statusText}` };
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        
        // Cek JSON Action (sama seperti sebelumnya)
        try {
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
                return JSON.parse(cleanText);
            }
        } catch (e) {}

        return { text: text };

    } catch (error) {
        console.error("Network Error:", error);
        return { text: "Maaf, koneksi ke otak AI terputus. 🤯" };
    }
}

module.exports = { processWithAI };
