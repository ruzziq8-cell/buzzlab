require('dotenv').config();

const API_KEY = "AIzaSyBiaIBu_pb73YFGxsi1qf6E8qeaoDjaCnQ"; // New Key

async function checkModels() {
    console.log("Checking models with key:", API_KEY);
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
            console.error("Error fetching models:", data);
            return;
        }
        
        console.log("Available Models:");
        if (data.models) {
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name} (${m.displayName})`);
                }
            });
        } else {
            console.log("No models found in response:", data);
        }
        
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

checkModels();
