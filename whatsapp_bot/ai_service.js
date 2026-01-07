// Gunakan native fetch (Node 18+)
// const fetch = require('node-fetch'); // HAPUS INI karena menyebabkan error MODULE_NOT_FOUND jika tidak diinstall

async function processWithAI(userMessage, context = "") {
    // === SOLUSI PAMUNGKAS: POLLINATIONS.AI ===
    // KELEBIHAN: GRATIS & TIDAK BUTUH API KEY SAMA SEKALI!
    
    const url = "https://text.pollinations.ai/";

    // Format prompt sederhana
    const systemPrompt = `Kamu adalah asisten AI untuk "BuzzLab", aplikasi To-Do List.
Jawablah dengan santai, sopan, dan singkat dalam Bahasa Indonesia.
Jangan terlalu formal. Gunakan emoji sesekali.`;

    const fullPrompt = `${systemPrompt}\n\nCONTEXT: ${context}\n\nUSER: ${userMessage}`;

    // Cek apakah fetch tersedia (Node 18+)
    if (typeof fetch === 'undefined') {
        console.error("[AI SERVICE] ❌ Global 'fetch' not found! Node.js version might be too old (need 18+).");
        return "Maaf, sistem AI sedang error (Node.js version issue).";
    }

    try {
        console.log(`[AI SERVICE] Mengirim request ke Pollinations (No-Key)...`);
        
        // Pollinations menerima text body langsung atau JSON
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `CONTEXT: ${context}\n\nUSER: ${userMessage}` }
                ],
                model: 'openai', // Menggunakan proxy OpenAI gratis mereka
                seed: 42
            })
        });

        if (!response.ok) {
            console.error(`[AI SERVICE] Error Pollinations: ${response.status}`);
            return { text: "Maaf, server AI sedang sibuk. Coba lagi nanti." };
        }

        // Pollinations langsung mengembalikan teks jawaban (bukan JSON kompleks)
        const text = await response.text();
        
        if (!text) {
             return { text: "Maaf, AI tidak menjawab." };
        }

        console.log(`[AI SERVICE] Sukses!`);
        
        // Cek JSON Action
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
