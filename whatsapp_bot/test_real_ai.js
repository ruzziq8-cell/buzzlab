const { processWithAI } = require('./ai_service');

async function test() {
    console.log("Testing processWithAI...");
    const response = await processWithAI("Halo, tes 123");
    console.log("Response:", response);
}

test();
