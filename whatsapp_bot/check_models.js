require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("Memeriksa API Key:", apiKey ? "✅ Terdeteksi" : "❌ TIDAK ADA");
    
    if (!apiKey) {
        console.error("Harap isi GEMINI_API_KEY di file .env");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    try {
        console.log("\n[DIAGNOSTIC] Mengambil daftar model yang tersedia untuk API Key ini...");
        // Gunakan listModels() bawaan library untuk melihat apa yang diizinkan
        // Note: Library versi lama mungkin tidak punya method ini di root, kita coba via getGenerativeModel
        
        // Coba manual fetch jika library belum support listModels
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Model object created. Testing generation...");
        
        const result = await model.generateContent("Tes koneksi. Balas 'OK' jika masuk.");
        console.log("✅ KONEKSI BERHASIL! Respons:", result.response.text());
        
    } catch (error) {
        console.error("❌ DIAGNOSA GAGAL:", error.message);
        console.log("\n--- KEMUNGKINAN PENYEBAB ---");
        console.log("1. API Key salah / typo (Cek spasi di awal/akhir)");
        console.log("2. API Key belum diaktifkan di Google AI Studio");
        console.log("3. Kuota habis / Billing bermasalah");
        console.log("4. IP Address Termux diblokir Google (Jarang terjadi)");
    }
}

listModels();