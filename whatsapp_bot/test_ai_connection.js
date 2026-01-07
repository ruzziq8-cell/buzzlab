require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testAI() {
    console.log("Checking API Key...");
    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ API Key not found!");
        return;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const modelsToTry = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-2.0-flash-exp"];

    for (const modelName of modelsToTry) {
        console.log(`\nTrying model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        try {
            const result = await model.generateContent("Halo!");
            const response = await result.response;
            console.log(`✅ SUCCESS with ${modelName}:`, response.text());
            return; // Exit on first success
        } catch (error) {
            console.error(`❌ Failed with ${modelName}:`, error.message.split('\n')[0]);
        }
    }
}

testAI();
