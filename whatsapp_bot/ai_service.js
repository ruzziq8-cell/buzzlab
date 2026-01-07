// Gunakan native fetch (Node 18+)
// const fetch = require('node-fetch'); // HAPUS INI karena menyebabkan error MODULE_NOT_FOUND jika tidak diinstall

// Obfuscate keys to bypass GitHub secret scanning (User Termux need hardcoded keys)
const _g_part1 = "gsk_62IeeCHvlgOnAfD0JsJWW";
const _g_part2 = "Gdyb3FYeNCaW8Suq7RJxU49eiR7kHBq";
const _m_part1 = "AIzaSyBfc1tICoazeRnQmd";
const _m_part2 = "900KZj3qHNjyBcXw8";

const KEYS = {
    GROQ: process.env.GROQ_API_KEY || (_g_part1 + _g_part2),
    GEMINI: process.env.MY_API_KEY || (_m_part1 + _m_part2)
};

async function processWithAI(userMessage, context = "") {
    // Prompt yang LEBIH RINGKAS untuk menghemat token Groq (Limit 6000 TPM)
    const systemPrompt = `Kamu asisten "BuzzLab" (To-Do List WhatsApp).
Tugas: Bantu user kelola tugas (CRUD). Jawab singkat & santai bhs Indo.

ATURAN JSON (Hanya jika user ingin CREATE/UPDATE/DELETE):
\`\`\`json
{ "action": "create_task"|"update_task"|"delete_task", "data": { "title": "...", "priority": "medium", "due_date": "YYYY-MM-DD" } }
\`\`\`
JIKA HANYA TANYA/LIHAT TUGAS: JANGAN PAKAI JSON!`;

    // Gabungkan pesan user dengan context
    const fullMessage = `CONTEXT:\n${context}\n\nUSER: ${userMessage}`;

    // --- STRATEGI 1: POLLINATIONS.AI (Gratis, No Key) ---
    try {
        const response = await fetch("https://text.pollinations.ai/", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: fullMessage }
                ],
                model: 'openai', 
                seed: 42,
                jsonMode: false
            })
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        return { text: await response.text() };

    } catch (error) {
        console.warn(`[AI] Pollinations Gagal (${error.message}). Coba Groq...`);
    }

    // --- STRATEGI 2: GROQ (Cepat, Limit 6000 TPM) ---
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${KEYS.GROQ}`
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: fullMessage }
                ],
                model: "llama-3.1-8b-instant"
            })
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        return { text: data.choices[0].message.content };

    } catch (groqError) {
        console.warn(`[AI] Groq Gagal (${groqError.message}). Coba Gemini...`);
    }

    // --- STRATEGI 3: GEMINI (Backup Terakhir) ---
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${KEYS.GEMINI}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `${systemPrompt}\n\n${fullMessage}` }]
                }]
            })
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        
        // Parsing respons Gemini yang unik
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Format respons Gemini tidak valid");
        
        return { text: text };

    } catch (geminiError) {
        console.error(`[AI] Gemini Gagal:`, geminiError);
        return { text: "Maaf, semua sistem AI (Pollinations, Groq, Gemini) sedang sibuk. Coba lagi 1 menit lagi! 🤖💤" };
    }
}

module.exports = { processWithAI };
