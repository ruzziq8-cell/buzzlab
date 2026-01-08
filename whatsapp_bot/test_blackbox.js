
async function testBlackbox() {
    console.log("Testing Blackbox AI...");
    
    try {
        const response = await fetch("https://www.blackbox.ai/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://www.blackbox.ai",
                "Referer": "https://www.blackbox.ai/"
            },
            body: JSON.stringify({
                messages: [{ role: "user", content: "Halo, jawab singkat saja 'OK'." }],
                previewToken: null,
                userId: null,
                codeModelMode: true,
                agentMode: {},
                trendingAgentMode: {},
                isMicMode: false,
                isChromeExt: false,
                githubToken: null
            })
        });

        console.log("Status:", response.status);
        
        if (!response.ok) {
            console.error("Error:", await response.text());
            return;
        }

        const text = await response.text();
        console.log("Response Length:", text.length);
        console.log("Response Preview:", text.substring(0, 100));

    } catch (error) {
        console.error("Test Failed:", error.message);
        if (error.cause) console.error("Cause:", error.cause);
    }
}

testBlackbox();
