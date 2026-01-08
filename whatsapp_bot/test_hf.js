
async function testHF() {
    console.log("Testing Hugging Face (No Token)...");
    
    // Model: Phi-3-mini (Small & Fast)
    // Endpoint: https://api-inference.huggingface.co/models/microsoft/Phi-3-mini-4k-instruct
    const model = "microsoft/Phi-3-mini-4k-instruct";
    
    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
                // No Authorization header
            },
            body: JSON.stringify({
                inputs: "<|user|>\nHalo, apa kabar?<|end|>\n<|assistant|>",
                parameters: {
                    max_new_tokens: 100,
                    return_full_text: false
                }
            })
        });

        console.log("Status:", response.status);
        
        if (!response.ok) {
            console.error("Error:", await response.text());
            return;
        }

        const data = await response.json();
        console.log("Result:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testHF();
