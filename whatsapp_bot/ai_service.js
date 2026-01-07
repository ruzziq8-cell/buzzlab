// Gunakan native fetch (Node 18+)
// const fetch = require('node-fetch'); // HAPUS INI karena menyebabkan error MODULE_NOT_FOUND jika tidak diinstall

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
        // Cek apakah fetch tersedia (Node 18+)
        if (typeof fetch === 'undefined') {
            console.error("[AI SERVICE] ❌ Global 'fetch' not found! Node.js version might be too old (need 18+).");
            return "Maaf, sistem AI sedang error (Node.js version issue).";
        }

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
