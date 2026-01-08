
async function testHFNew() {
    console.log("Testing Hugging Face Router (No Token)...");
    
    // Model: Phi-3-mini
    const model = "microsoft/Phi-3-mini-4k-instruct";
    
    try {
        const response = await fetch(`https://router.huggingface.co/models/${model}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
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

testHFNew();
