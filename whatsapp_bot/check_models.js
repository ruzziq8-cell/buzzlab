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
        // Coba model gemini-1.5-flash langsung dulu
        console.log("\n[TEST 1] Mencoba akses model 'gemini-1.5-flash'...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Tes halo");
        console.log("✅ BERHASIL! Respons:", result.response.text());
    } catch (error) {
        console.error("❌ GAGAL Test 1:", error.message);
    }

    try {
        // Coba model gemini-pro (versi lama tapi stabil)
        console.log("\n[TEST 2] Mencoba akses model 'gemini-pro'...");
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Tes halo");
        console.log("✅ BERHASIL! Respons:", result.response.text());
    } catch (error) {
        console.error("❌ GAGAL Test 2:", error.message);
    }
}

listModels();