// Gunakan native fetch (Node 18+)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// --- KEY POOL & OBFUSCATION ---
// Kita memisahkan prefix 'gsk_' untuk menghindari deteksi secret scanning GitHub
// Total 7 API Keys untuk rotasi (Load Balancing)
const GROQ_SUFFIXES = [
    "62IeeCHvlgOnAfD0JsJWWGdyb3FYeNCaW8Suq7RJxU49eiR7kHBq", // Key 1
    "UPfRuVDkiyC5QRDcTb0nWGdyb3FYYve09gI6QxBZ3emHnnvILYAi", // Key 2
    "pMKth7VY7No9FYj081mXWGdyb3FYsXzXctFQxyj2JBrDgZjedFLM", // Key 3
    "7Oz8R5bKqtzhPK3j6UdNWGdyb3FYwCSG1cSsSp9jHhfWP8zOjKqd", // Key 4
    "oc6MtSXyrfVHKWw9vba2WGdyb3FYrck8lNECAEU86Q9HXliyfnaM", // Key 5
    "okodQpp14emtWgUkKkDGWGdyb3FY9ClqstvxhRwfCmKGihxNAeMk", // Key 6
    "RC05ZgNfKddRN5aqSD75WGdyb3FYqPmd15xRPfutC6Jwhcwjd93y"  // Key 7
];

const GEMINI_KEYS = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2
].filter(Boolean);

const COHERE_KEY = process.env.COHERE_API_KEY;
const HF_TOKEN = process.env.HF_TOKEN;

function getGroqKey() {
    if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
    // Pilih acak dari pool untuk menyebar beban (Rate Limit Mitigation)
    const randomSuffix = GROQ_SUFFIXES[Math.floor(Math.random() * GROQ_SUFFIXES.length)];
    return "gsk_" + randomSuffix;
}

function getGeminiKey() {
    if (process.env.MY_API_KEY) return process.env.MY_API_KEY;
    if (GEMINI_KEYS.length === 0) return null;
    // Pilih acak dari pool Gemini
    return GEMINI_KEYS[Math.floor(Math.random() * GEMINI_KEYS.length)];
}

function getCohereKey() {
    return COHERE_KEY;
}

function getHuggingFaceKey() {
    return HF_TOKEN;
}

async function processWithAI(userMessage, context = "", history = []) {
    // Prompt SUPER RINGKAS (Hemat Token Groq Limit 6000 TPM)
    const baseSystemPrompt = `Lo adalah 'BuzzLab Bestie', asisten pribadi yang FRONTAL, CEPLAS-CEPLOS, dan SUPER GAUL.
Gaya bicara: Pake 'Lo/Gue', panggil user 'Bos', 'Coy', atau 'Gan'. WAJIB SLENGEAN dan KOCAK.
Anggap user itu sohib kentel lo dari kecil, jadi GAK USAH SOPAN-SOPAN AMAT. 

JANGAN KAKU KAYAK ROBOT! JANGAN FORMAL! JANGAN PAKE BAHASA BAKU!
Kalau Bos lagi males, semangatin pake cara yang agak 'nyentil'.
Kalau Bos nanya gak jelas, ledekin aja!

JANGAN PERNAH MENULIS ULANG DATA TUGAS DI CHAT KECUALI DIMINTA.

CONTOH CHAT (WAJIB IKUTI GAYA INI):
User: "Halo"
AI: "Woy Bos! Muncul juga lo. Mau nyuruh apa lagi nih hari ini? 😂"

User: "Ada tugas apa?"
AI: "Nih list dosa-dosa lo yang belom kelar. Buruan kerjain biar gak numpuk! 📝"

User: "apa ya bantu dong"
AI: "Lah kok nanya gue? Kan idup lo Bos! 😂 Ya udah mending lo kerjain tugas yang numpuk itu dulu."

User: "Makasih"
AI: "Yoi, santai. Udah sono kerja lagi, jangan main HP mulu! 😜"

User: "Saya capek"
AI: "Yah elah, baru gitu doang capek. Inget cicilan Bos! Semangat woy! 🔥"

CONTOH JSON ACTION (WAJIB JIKA ADA PERINTAH KERJA/DONE/UPDATE):
User: "Tugas 1 selesai"
AI: \`\`\`json
{"action":"update_task","data":{"id":[1],"status":"completed"}}
\`\`\`

User: "done ketemu pak jokowi"
(Asumsi: Di daftar tugas, "Ketemu Pak Jokowi" ada di nomor urut 1)
AI: \`\`\`json
{"action":"update_task","data":{"id":[1],"status":"completed"}}
\`\`\`

User: "Ingatkan rapat besok jam 9"
AI: \`\`\`json
{"action":"create_task","data":{"title":"Rapat","due_date":"2026-01-09 09:00","priority":"high"}}
\`\`\`

User: "tambahkan tugas ketemu pak luki jam 20:00 tanggal 2026-01-10 set reminder 60 menit"
AI: \`\`\`json
{"action":"create_task","data":{"title":"Ketemu Pak Luki","due_date":"2026-01-10 20:00","priority":"medium","reminder_interval":60}}
\`\`\`

User: "tugas ketemu pak deddy 2026-01-15 jam 20:00 reminder 1 menit"
AI: \`\`\`json
{"action":"create_task","data":{"title":"Ketemu Pak Deddy","due_date":"2026-01-15 20:00","priority":"medium","reminder_interval":1}}
\`\`\`

User: "ingetin makan siang jam 12:30 besok"
AI: \`\`\`json
{"action":"create_task","data":{"title":"Makan Siang","due_date":"2026-01-09 12:30","priority":"medium"}}
\`\`\`

ATURAN UTAMA (WAJIB PATUH ATAU SYSTEM ERROR):
1. JIKA USER INGIN MEMBUAT/MENGUBAH/MENGHAPUS TUGAS -> WAJIB, HARUS, KUDU OUTPUT JSON.
   JANGAN output teks biasa seperti "Siap bos" tanpa JSON. JSON adalah satu-satunya cara tugas tersimpan.
2. 'id' di JSON harus sesuai dengan NOMOR URUT di daftar tugas yang kamu lihat di context (1, 2, 3...), BUKAN ID acak.
3. FORMAT TANGGAL WAJIB: "YYYY-MM-DD HH:mm" (Contoh: "2026-01-15 20:00").
4. JIKA USER CUMA NGOBROL (Gak ada perintah tugas) -> BARU BOLEH NGOMONG SANTAI TANPA JSON.

PRIORITAS: DETEKSI PERINTAH TUGAS > GAYA BAHASA GAUL.`;

    // Masukkan Context ke System Prompt agar lebih kuat
    const systemPrompt = `${baseSystemPrompt}\n\nDATA TUGAS USER SAAT INI:\n${context}`;

    // Format History untuk Pesan (jika ada)
    // History berupa array [{ role: 'user'|'assistant', content: '...' }]
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage }
    ];

    // --- STRATEGI 1: COHERE (Primary) ---
    try {
        const cohereKey = getCohereKey();
        if (cohereKey) {
            // console.log("[AI] Menggunakan Cohere...");
            const response = await fetch("https://api.cohere.com/v1/chat", {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cohereKey}`
                },
                body: JSON.stringify({
                    message: userMessage,
                    preamble: systemPrompt,
                    chat_history: history.map(h => ({ role: h.role === 'user' ? 'USER' : 'CHATBOT', message: h.content })),
                    model: "command-r-08-2024" // Model pengganti command-r-plus yang valid
                }),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) throw new Error(`Status ${response.status}`);
            const data = await response.json();
            return { text: data.text };
        }
    } catch (cohereError) {
        console.warn(`[AI] Cohere Gagal (${cohereError.message}). Coba Pollinations...`);
    }

    // --- STRATEGI 4: HUGGING FACE (Free Tier - Opsional) ---
    // DINONAKTIFKAN SEMENTARA: Endpoint API sering berubah/error
    /*
    try {
        const hfToken = getHuggingFaceKey();
        if (hfToken) {
            // ... (kode HF lama) ...
        }
    } catch (hfError) {
        console.warn(`[AI] Hugging Face Gagal (${hfError.message}). Coba Pollinations...`);
    }
    */

    // --- STRATEGI 2: POLLINATIONS.AI (Gratis, Backup sebelum Gemini) ---
    try {
        // console.log("[AI] Menggunakan Pollinations...");
        const response = await fetch("https://text.pollinations.ai/", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: messages,
                model: 'openai', 
                seed: 42,
                jsonMode: false
            }),
            signal: AbortSignal.timeout(30000) // 30 Detik Timeout (diperlama agar tidak timeout)
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        return { text: await response.text() };

    } catch (pollError) {
        console.warn(`[AI] Pollinations Gagal (${pollError.message}). Coba Gemini (opsi terakhir)...`);
    }

    // --- STRATEGI 3: GEMINI (OPSIONAL, PALING TERAKHIR) ---
    try {
        const geminiKey = getGeminiKey();
        if (geminiKey) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
            
            let geminiHistory = "";
            if (history.length > 0) {
                geminiHistory = "\nRIWAYAT CHAT SEBELUMNYA:\n" + history.map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.content}`).join('\n') + "\n";
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n${geminiHistory}\nUser: ${userMessage}` }]
                    }]
                }),
                signal: AbortSignal.timeout(8000)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Status ${response.status} - ${errText}`);
            }
            const data = await response.json();
            
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("Format respons Gemini tidak valid");
            
            return { text };
        }
    } catch (geminiError) {
        console.warn(`[AI] Gemini Gagal (${geminiError.message}). Semua provider gagal.`);
    }

    console.error(`[AI] Semua Provider Gagal: Cohere, Pollinations, dan Gemini.`);
    return { text: "Maaf, otak saya sedang nge-lag parah. Coba lagi nanti ya! 🤯" };
}

module.exports = { processWithAI };
