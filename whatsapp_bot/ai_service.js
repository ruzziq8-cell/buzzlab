// Gunakan native fetch (Node 18+)
// const fetch = require('node-fetch'); // HAPUS INI karena menyebabkan error MODULE_NOT_FOUND jika tidak diinstall

const GROQ_API_KEY = process.env.GROQ_API_KEY;

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
        console.warn(`[AI] Pollinations Gagal (${error.message}). Mengalihkan ke Groq...`);
    }

    // --- STRATEGI 2: GROQ (Backup via API Key) ---
    try {
        if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY belum disetting di Environment Variable!");

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `CONTEXT:\n${context}\n\nUSER: ${userMessage}` }
                ],
                model: "llama3-8b-8192"
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const text = data.choices[0].message.content;
        return { text: text };

    } catch (groqError) {
        console.error("[AI] Groq juga gagal:", groqError);
        return { text: "Maaf, semua server AI (Pollinations & Groq) sedang sibuk/error. Coba lagi nanti ya! 🤖💤" };
    }
}

module.exports = { processWithAI };
