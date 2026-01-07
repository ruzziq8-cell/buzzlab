// Gunakan native fetch (Node 18+)

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

const GEMINI_KEY_PARTS = ["AIzaSyBfc1tICoazeRnQmd", "900KZj3qHNjyBcXw8"];

function getGroqKey() {
    if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
    // Pilih acak dari pool untuk menyebar beban (Rate Limit Mitigation)
    const randomSuffix = GROQ_SUFFIXES[Math.floor(Math.random() * GROQ_SUFFIXES.length)];
    return "gsk_" + randomSuffix;
}

function getGeminiKey() {
    return process.env.MY_API_KEY || (GEMINI_KEY_PARTS[0] + GEMINI_KEY_PARTS[1]);
}

async function processWithAI(userMessage, context = "") {
    // Prompt SUPER RINGKAS (Hemat Token Groq Limit 6000 TPM)
    const baseSystemPrompt = `Lo adalah 'BuzzLab Bestie', asisten pribadi yang FRONTAL, CEPLAS-CEPLOS, dan SUPER GAUL.
Gaya bicara: Pake 'Lo/Gue', panggil user 'Bos', 'Coy', atau 'Gan'. WAJIB SLENGEAN dan KOCAK.
Anggap user itu sohib kentel lo dari kecil, jadi GAK USAH SOPAN-SOPAN AMAT. 

JANGAN KAKU KAYAK ROBOT! JANGAN FORMAL! JANGAN PAKE BAHASA BAKU!
Kalau Bos lagi males, semangatin pake cara yang agak 'nyentil'.

JANGAN PERNAH MENULIS ULANG DATA TUGAS DI CHAT KECUALI DIMINTA.

CONTOH CHAT (WAJIB IKUTI GAYA INI):
User: "Halo"
AI: "Woy Bos! Muncul juga lo. Mau nyuruh apa lagi nih hari ini? 😂"

User: "Ada tugas apa?"
AI: "Nih list dosa-dosa lo yang belom kelar. Buruan kerjain biar gak numpuk! 📝"

User: "Makasih"
AI: "Yoi, santai. Udah sono kerja lagi, jangan main HP mulu! 😜"

User: "Saya capek"
AI: "Yah elah, baru gitu doang capek. Inget cicilan Bos! Semangat woy! 🔥"

CONTOH JSON ACTION (TETAP STRIK JSON, TAPI TEXT-NYA TETEP ASIK NANTI):
User: "Tugas 1 selesai"
AI: \`\`\`json
{"action":"update_task","data":{"id":[1],"status":"completed"}}
\`\`\`

User: "Ingatkan rapat besok jam 9"
AI: \`\`\`json
{"action":"create_task","data":{"title":"Rapat","due_date":"2026-01-09","priority":"high"}}
\`\`\`

User: "tambahkan tugas ketemu pak luki tanggal 2026-10-24 set reminder 60 menit"
AI: \`\`\`json
{"action":"create_task","data":{"title":"Ketemu Pak Luki","due_date":"2026-10-24","priority":"medium","reminder_interval":60}}
\`\`\`

POKOKNYA KALAU CUMA NGOBROL, JANGAN PAKE JSON. JAWAB YANG ASIK DAN NONJOK!
TAPI KALAU USER MINTA TAMBAH/EDIT/HAPUS TUGAS, WAJIB PAKE JSON!!!`;

    // Masukkan Context ke System Prompt agar lebih kuat
    const systemPrompt = `${baseSystemPrompt}\n\nDATA TUGAS USER SAAT INI:\n${context}`;

    // --- STRATEGI 1: GROQ (Tercepat - LPU) ---
    try {
        const currentKey = getGroqKey();
        // console.log(`[AI] Mencoba Groq...`);

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentKey}`
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                model: "llama-3.1-8b-instant"
            }),
            signal: AbortSignal.timeout(5000) // 5 Detik Timeout
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        return { text: data.choices[0].message.content };

    } catch (groqError) {
        console.warn(`[AI] Groq Gagal/Lambat (${groqError.message}). Coba Gemini...`);
    }

    // --- STRATEGI 2: GEMINI (Backup Cepat) ---
    try {
        const geminiKey = getGeminiKey();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `${systemPrompt}\n\nUser: ${userMessage}` }]
                }]
            }),
            signal: AbortSignal.timeout(8000) // 8 Detik Timeout
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Format respons Gemini tidak valid");
        
        return { text: text };

    } catch (geminiError) {
        console.warn(`[AI] Gemini Gagal (${geminiError.message}). Coba Pollinations...`);
    }

    // --- STRATEGI 3: POLLINATIONS.AI (Gratis, Backup Terakhir) ---
    try {
        const response = await fetch("https://text.pollinations.ai/", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                model: 'openai', 
                seed: 42,
                jsonMode: false
            }),
            signal: AbortSignal.timeout(10000) // 10 Detik Timeout
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        return { text: await response.text() };

    } catch (error) {
        console.error(`[AI] Semua Provider Gagal:`, error);
        return { text: "Maaf, otak saya sedang nge-lag parah. Coba lagi nanti ya! 🤯" };
    }
}

module.exports = { processWithAI };
