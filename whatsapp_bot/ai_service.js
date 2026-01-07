// Gunakan native fetch (Node 18+)
// const fetch = require('node-fetch'); // HAPUS INI karena menyebabkan error MODULE_NOT_FOUND jika tidak diinstall

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBfc1tICoazeRnQmd900KZj3qHNjyBcXw8";

async function processWithAI(userMessage, context = "") {
    const systemPrompt = `Kamu adalah asisten AI untuk "BuzzLab", aplikasi To-Do List yang terintegrasi WhatsApp.
    
    TUGAS UTAMA: Membantu user mengelola tugas (CRUD).
    
    ATURAN PENTING (ACTION MODE):
    Jika user meminta menambah, mengubah, atau menghapus tugas, JANGAN HANYA MENJAWAB DENGAN TEKS!
    Kamu WAJIB menyertakan blok JSON khusus di AKHIR jawabanmu agar sistem bisa memprosesnya.
    
    FORMAT JSON ACTION:
    \`\`\`json
    {
        "action": "create_task" | "update_task" | "delete_task",
        "data": {
            "title": "Judul tugas",
            "priority": "low" | "medium" | "high",
            "due_date": "YYYY-MM-DD" (jika ada, default null),
            "reminder": "60" (menit, jika ada)
        }
    }
    \`\`\`

    CONTOH RESPON BENAR:
    "Siap, saya akan tambahkan tugas meeting dengan Pak Luki."
    \`\`\`json
    { "action": "create_task", "data": { "title": "Meeting dengan Pak Luki", "priority": "high", "due_date": "2026-01-08", "reminder": "60" } }
    \`\`\`
    
    Jawablah dengan santai, sopan, dan singkat dalam Bahasa Indonesia.`;

    const fullPrompt = `${systemPrompt}\n\nCONTEXT:\n${context}\n\nUSER: ${userMessage}`;

    // --- STRATEGI 1: POLLINATIONS.AI (Gratis) ---
    try {
        // console.log("[AI] Mencoba Pollinations...");
        const response = await fetch("https://text.pollinations.ai/", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `CONTEXT:\n${context}\n\nUSER: ${userMessage}` }
                ],
                model: 'openai', 
                seed: 42,
                jsonMode: false
            })
        });

        if (!response.ok) throw new Error(`Pollinations Status: ${response.status}`);
        
        const text = await response.text();
        return { text: text };

    } catch (error) {
        console.warn(`[AI] Pollinations Gagal (${error.message}). Mengalihkan ke Gemini...`);
    }

    // --- STRATEGI 2: GOOGLE GEMINI (Backup via API Key) ---
    try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: fullPrompt }]
                }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        return { text: text };

    } catch (geminiError) {
        console.error("[AI] Gemini juga gagal:", geminiError);
        return { text: "Maaf, semua server AI (Pollinations & Gemini) sedang sibuk/error. Coba lagi nanti ya! 🤖💤" };
    }
}

module.exports = { processWithAI };
