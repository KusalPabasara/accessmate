// background.js
// Import config
importScripts('config.js');

// API key loaded from config.js
const API_KEY = CONFIG.GOOGLE_API_KEY;
const GEN_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Click Icon -> Open UI
chrome.action.onClicked.addListener((tab) => {
  if(!tab.id) return;
  // Ensure we inject content script if missing (basic fallback)
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }).then(() => {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_SCAN" });
  }).catch(() => {
    // Already injected or other error, try sending message anyway
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_SCAN" });
  });
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "ANALYZE_ELEMENT") {
    generateElementFix(req.html, req.issueType)
       .then(result => sendResponse({ result }))
       .catch(e => sendResponse({ error: e.message }));
    return true; 
  }
  
  if (req.action === "ASK_PAGE") {
    askGemini(req.question, req.context).then(answer => sendResponse({ answer }));
    return true;
  }

  if (req.action === "DESCRIBE_IMAGE") {
    describeImage(req.src).then(description => sendResponse({ description }));
    return true;
  }
});

// --- API Calls ---

async function askGemini(question, context) {
   const prompt = `Context: ${context} 
 User Question: ${question} 
 Answer concisely.`;
   try {
     const res = await fetch(`${GEN_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
     });
     const data = await res.json();
     return data.candidates[0].content.parts[0].text;
   } catch(e) { return "I couldn't connect to AI."; }
}

async function describeImage(src) {
  try {
    // 60s Timeout Controller
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 60000);

    const imgRes = await fetch(src, { signal: controller.signal });
    const blob = await imgRes.blob();
    const base64 = await new Promise((resolve) => {
       const reader = new FileReader();
       reader.onloadend = () => resolve(reader.result.split(',')[1]);
       reader.readAsDataURL(blob);
    });
    clearTimeout(id);

    const res = await fetch(`${GEN_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
           contents: [{ 
              parts: [
                 { inlineData: { mimeType: blob.type, data: base64 } },
                 { text: "Describe this image concisely for a blind user." }
              ] 
           }] 
        })
    });
    
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  } catch (e) {
    return "Image analysis failed or timed out.";
  }
}

async function generateElementFix(html, issueType) {
   const prompt = `You are an accessibility expert. Fix this HTML element that has the following accessibility issue: "${issueType}".

Current HTML: ${html}

Provide the fixed HTML with proper accessibility attributes. For example:
- For "Missing Alt Text": Add a descriptive alt attribute
- For "Empty Interactive Element": Add aria-label or visible text
- For "Missing Form Label": Add aria-label attribute
- For "iFrame Missing Title": Add title attribute
- For "Non-keyboard Accessible": Add tabindex="0" and role="button"
- For "External Link Warning": Add aria-label mentioning "opens in new tab"

Return ONLY a JSON object with this format: {"fixedHtml": "<the fixed html element>"}`;

   try {
     const res = await fetch(`${GEN_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
     });
     const data = await res.json();
     const responseText = data.candidates[0].content.parts[0].text;
     
     // Try to parse as JSON
     try {
        return JSON.parse(responseText);
     } catch {
        // If parsing fails, try to extract fixedHtml from the response
        const match = responseText.match(/"fixedHtml"\s*:\s*"([^"]+)"/);
        if (match) {
           return { fixedHtml: match[1].replace(/\\"/g, '"') };
        }
        return { fixedHtml: html }; // Return original if can't parse
     }
   } catch(e) { 
      console.error('[AccessMate] AI fix error:', e);
      return { fixedHtml: null }; 
   }
}
