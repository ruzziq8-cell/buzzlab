const { GoogleGenerativeAI } = require("@google/generative-ai");

// HARDCODED API KEY (Sementara, untuk fix masalah environment variable di Termux)
// Key Baru: AIzaSyBfc1tICoazeRnQmd900KZj3qHNjyBcXw8
const FORCE_API_KEY = "AIzaSyBfc1tICoazeRnQmd900KZj3qHNjyBcXw8";

// Inisialisasi Gemini
// Prioritaskan Hardcoded Key jika ada
const apiKey = FORCE_API_KEY || process.env.GEMINI_API_KEY;

if (apiKey) {
    console.log(`[AI SERVICE] API Key loaded: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);
} else {
    console.error("[AI SERVICE] ❌ API KEY MISSING IN ENV!");
}

const genAI = new GoogleGenerativeAI(apiKey);

async function processWithAI(userMessage, context = "") {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return {
                text: "⚠️ API Key Gemini belum disetting. Silakan minta admin untuk menambahkan `GEMINI_API_KEY` di file `.env` atau environment variables."
            };
        }

        // DAFTAR MODEL YANG AKAN DICOBA (Fallback Mechanism)
        // Jika model pertama gagal (404/429), akan mencoba model berikutnya
        const modelsToTry = [
            "gemini-1.5-flash-latest", // Prioritas 1: Flash terbaru
            "gemini-1.5-flash-001",    // Prioritas 2: Flash versi stabil 001
            "gemini-1.5-flash",        // Prioritas 3: Flash alias standar
            "gemini-pro"               // Prioritas 4: Fallback ke 1.0 Pro (pasti ada)
        ];

        let lastError = null;
        let result = null;
        let usedModel = "";

        // Loop untuk mencoba model satu per satu
        for (const modelName of modelsToTry) {
            try {
                // console.log(`Mencoba model AI: ${modelName}...`); // Debugging (optional)
                const model = genAI.getGenerativeModel({ model: modelName });
                
                const systemPrompt = `
Kamu adalah asisten AI untuk "BuzzLab", sebuah aplikasi To-Do List.
Tugasmu adalah membantu user mengelola tugas atau sekadar mengobrol santai.
Gunakan Bahasa Indonesia yang santai tapi sopan.

**INSTRUKSI UTAMA:**
1. Jika user ingin MENAMBAH TUGAS (contoh: "Ingatkan beli susu besok", "Tambah tugas meeting jam 9"):
   - Ekstrak informasi: Judul, Prioritas (low/medium/high), Tenggat Waktu (Format YYYY-MM-DD HH:mm), dan Interval Reminder (dalam menit).
   - JANGAN membalas dengan teks biasa. Balas HANYA dengan JSON berikut:
     {
       "action": "add_task",
       "data": {
         "title": "Judul Tugas",
         "priority": "medium", // default medium jika tidak disebut
         "due_date": "2024-01-01 09:00", // atau null jika tidak ada waktu
         "reminder_interval": 0 // default 0, atau 15/30/60 sesuai permintaan
       }
     }

2. Jika user ingin MELIHAT TUGAS atau BERTANYA tentang tugas:
   - Jawab berdasarkan data tugas yang diberikan di bagian CONTEXT di bawah.
   - Jangan mengarang tugas yang tidak ada.

3. Jika obrolan biasa (sapaan, curhat, tanya umum):
   - Balaslah sebagai teman ngobrol yang asik.

**CONTEXT (Daftar Tugas User Saat Ini):**
${context}

**User Message:**
${userMessage}
`;

                result = await model.generateContent(systemPrompt);
                usedModel = modelName;
                break; // Jika berhasil, keluar dari loop

            } catch (e) {
                console.error(`Gagal dengan model ${modelName}:`, e.message);
                lastError = e;
                
                // Jika errornya 429 (Quota), jangan lanjut coba-coba, langsung stop biar gak kena ban
                if (e.message && e.message.includes("429")) {
                    throw e; 
                }
                // Jika error lain (misal 404), lanjut ke model berikutnya
                continue;
            }
        }

        // Jika semua model gagal
        if (!result) {
            throw lastError || new Error("Semua model AI gagal merespons.");
        }

        const response = await result.response;
        const text = response.text();

        // Cek apakah output adalah JSON (Action)
        try {
            // Bersihkan markdown block jika ada (```json ... ```)
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
                const action = JSON.parse(cleanText);
                return action; // Mengembalikan object action
            }
        } catch (e) {
            // Bukan JSON valid, berarti chat biasa
        }

        return { text: text }; // Chat biasa

    } catch (error) {
        console.error("AI Error:", error);
        
        // Handle Rate Limit / Quota Exceeded (Error 429)
        if (error.message && error.message.includes("429")) {
             return { text: "⏳ Waduh, saya terlalu banyak mikir barusan. Kuota AI sedang penuh. Coba tanya lagi dalam 1 menit ya!" };
        }

        return { text: "Maaf, otak AI saya sedang error sebentar. 🤯" };
    }
}

module.exports = { processWithAI };
