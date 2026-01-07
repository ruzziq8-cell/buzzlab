const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function processWithAI(userMessage, context = "") {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return {
                text: "⚠️ API Key Gemini belum disetting. Silakan minta admin untuk menambahkan `GEMINI_API_KEY` di file `.env` atau environment variables."
            };
        }

        // Gunakan model 'gemini-1.5-flash' yang lebih stabil dan memiliki kuota gratis lebih besar
        // Hindari 'gemini-flash-latest' karena kadang mengarah ke versi experimental dengan kuota sangat kecil
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

        const result = await model.generateContent(systemPrompt);
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
