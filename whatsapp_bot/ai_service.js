// Gunakan native fetch (Node 18+)
// const fetch = require('node-fetch'); // HAPUS INI karena menyebabkan error MODULE_NOT_FOUND jika tidak diinstall

async function processWithAI(userMessage, context = "") {
    // KITA AKAN GUNAKAN KEY BARU ANDA YANG TADI: AIzaSyBfc1tICoazeRnQmd900KZj3qHNjyBcXw8
    const apiKey = "AIzaSyBfc1tICoazeRnQmd900KZj3qHNjyBcXw8";
    
    // DAFTAR MODEL YANG AKAN DICOBA SATU PER SATU
    const modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-pro",
        "gemini-1.0-pro"
    ];

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

    // Cek apakah fetch tersedia (Node 18+)
    if (typeof fetch === 'undefined') {
        console.error("[AI SERVICE] ❌ Global 'fetch' not found! Node.js version might be too old (need 18+).");
        return "Maaf, sistem AI sedang error (Node.js version issue).";
    }

    // LOOPING COBA MODEL SATU PER SATU
    for (const model of modelsToTry) {
        console.log(`[AI SERVICE] Mencoba model: ${model}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[AI SERVICE] Gagal pakai ${model}:`, response.status);
                
                // Jika error 404 (Model Not Found) atau 503 (Overloaded), lanjut ke model berikutnya
                if (response.status === 404 || response.status === 503) {
                    continue; // Coba model berikutnya
                }
                
                // Jika error Auth (400), langsung berhenti
                if (response.status === 400 && errorText.includes("API_KEY_INVALID")) {
                    return { text: "⚠️ API Key salah atau belum aktif." };
                }
                
                // Error lain, lanjut coba model lain siapa tahu bisa
                continue;
            }

            const data = await response.json();
            
            // Cek apakah ada candidates
            if (!data.candidates || data.candidates.length === 0) {
                 console.error(`[AI SERVICE] ${model} merespon tapi tanpa jawaban.`);
                 continue;
            }

            const text = data.candidates[0].content.parts[0].text;
            console.log(`[AI SERVICE] Sukses dengan model: ${model}`);
            
            // Cek JSON Action
            try {
                const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
                    return JSON.parse(cleanText);
                }
            } catch (e) {}

            return { text: text };

        } catch (error) {
            console.error(`[AI SERVICE] Error koneksi ke ${model}:`, error.message);
            // Lanjut ke model berikutnya jika koneksi gagal
        }
    }

    // Jika semua model gagal
    return { text: "Maaf, semua model AI sedang sibuk atau tidak tersedia saat ini. Coba lagi nanti ya! 🤯" };
}

module.exports = { processWithAI };
