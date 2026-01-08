
async function testDDG() {
    console.log("Testing DuckDuckGo AI...");
    
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    
    try {
        // 1. Get VQD Token
        console.log("1. Getting VQD Token...");
        const statusRes = await fetch("https://duckduckgo.com/duckchat/v1/status", {
            headers: {
                "User-Agent": UA,
                "x-api-key": "duckduckgo-staging-api-key" // Sometimes needed?
            }
        });
        
        const vqd = statusRes.headers.get("x-vqd-4");
        console.log("Status Code:", statusRes.status);
        console.log("VQD Token:", vqd);
        
        if (!vqd) {
            console.error("Failed to get VQD token");
            return;
        }

        // 2. Chat
        console.log("2. Sending Chat Request...");
        const chatRes = await fetch("https://duckduckgo.com/duckchat/v1/chat", {
            method: "POST",
            headers: {
                "User-Agent": UA,
                "Content-Type": "application/json",
                "x-vqd-4": vqd
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: "Halo, ini tes. Jawab singkat." }]
            })
        });

        console.log("Chat Status:", chatRes.status);
        
        if (!chatRes.ok) {
            console.error("Chat Error:", await chatRes.text());
            return;
        }

        // DDG returns stream usually, let's see if we can get text
        const text = await chatRes.text();
        console.log("Raw Response Length:", text.length);
        
        // Parse SSE (Server Sent Events)
        const lines = text.split('\n');
        let fullText = "";
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') break;
                try {
                    const json = JSON.parse(dataStr);
                    if (json.message) fullText += json.message;
                } catch (e) {}
            }
        }
        
        console.log("Final Result:", fullText);

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testDDG();
