// Gunakan native fetch (Node 18+)
// const fetch = require('node-fetch'); // HAPUS INI karena menyebabkan error MODULE_NOT_FOUND jika tidak diinstall

async function processWithAI(userMessage, context = "") {
    // === SOLUSI PAMUNGKAS: POLLINATIONS.AI ===
    // KELEBIHAN: GRATIS & TIDAK BUTUH API KEY SAMA SEKALI!
    try {
        const url = "https://text.pollinations.ai/";
        
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

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `CONTEXT:\n${context}\n\nUSER: ${userMessage}` }
                ],
                model: 'openai', // Model gratis terbaik di Pollinations
                seed: 42,
                jsonMode: false // Kita parsing manual saja biar aman
            })
        });

        if (!response.ok) throw new Error(`Pollinations Error: ${response.status}`);
        
        const text = await response.text();
        return { text: text };

    } catch (error) {
        console.error("AI Service Error:", error);
        return { text: "Maaf, otak saya sedang offline sebentar. Coba lagi nanti ya! 🤖💤" };
    }
}

module.exports = { processWithAI };
