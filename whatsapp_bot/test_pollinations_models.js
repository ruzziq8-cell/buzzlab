
async function testPollinationsModels() {
    const models = ['openai', 'mistral', 'llama', 'search'];
    
    for (const model of models) {
        console.log(`\nTesting Pollinations Model: ${model}...`);
        try {
            const response = await fetch("https://text.pollinations.ai/", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: 'Halo, siapa kamu?' }],
                    model: model,
                    seed: 42,
                    jsonMode: false
                }),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                console.error(`❌ Failed ${model}: Status ${response.status}`);
            } else {
                const text = await response.text();
                console.log(`✅ Success ${model}:`, text.substring(0, 100));
            }

        } catch (error) {
            console.error(`❌ Error ${model}:`, error.message);
        }
    }
}

testPollinationsModels();
