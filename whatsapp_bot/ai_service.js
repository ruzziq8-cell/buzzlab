// Gunakan native fetch (Node 18+)
// const fetch = require('node-fetch'); // HAPUS INI karena menyebabkan error MODULE_NOT_FOUND jika tidak diinstall

async function processWithAI(userMessage, context = "") {
    // === GANTI KE GROQ (LEBIH STABIL & GRATIS) ===
    // Masukkan API Key Groq Anda di sini nanti
    // Contoh: "gsk_8g..."
    const apiKey = process.env.GROQ_API_KEY || "MASUKKAN_KEY_GROQ_DISINI"; 
    
    // Kita gunakan model Llama 3 (Cerdas & Cepat)
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const payload = {
        model: "llama3-8b-8192", // Model yang sangat cepat dan gratis
        messages: [
            {
                role: "system",
                content: `Kamu adalah asisten AI untuk "BuzzLab", aplikasi To-Do List.
Jawablah dengan santai, sopan, dan singkat dalam Bahasa Indonesia.
Jangan terlalu formal. Gunakan emoji sesekali.`
            },
            {
                role: "user",
                content: `CONTEXT: ${context}\n\nUSER: ${userMessage}`
            }
        ],
        temperature: 0.7
    };

    // Cek apakah fetch tersedia (Node 18+)
    if (typeof fetch === 'undefined') {
        console.error("[AI SERVICE] ❌ Global 'fetch' not found! Node.js version might be too old (need 18+).");
        return "Maaf, sistem AI sedang error (Node.js version issue).";
    }

    try {
        console.log(`[AI SERVICE] Mengirim request ke Groq...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI SERVICE] Error Groq: ${response.status} - ${errorText}`);
            
            if (response.status === 401) {
                return { text: "⚠️ API Key Groq belum disetting atau salah." };
            }
            return { text: `⚠️ Error AI: ${response.status}` };
        }

        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
             return { text: "Maaf, AI sedang melamun (no response)." };
        }

        const text = data.choices[0].message.content;
        console.log(`[AI SERVICE] Sukses!`);
        
        // Cek JSON Action (jika AI membalas dengan format JSON untuk aksi)
        try {
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
                return JSON.parse(cleanText);
            }
        } catch (e) {}

        return { text: text };

    } catch (error) {
        console.error(`[AI SERVICE] Network Error:`, error.message);
        return { text: "Maaf, koneksi internet bot sedang bermasalah." };
    }
}

module.exports = { processWithAI };
