const fs = require("fs");
const Database = require('better-sqlite3');
const db = new Database('/Users/douglasrodrigues/Library/Application Support/Electron/cowork-local-ai.sqlite');
const row = db.prepare("SELECT value FROM app_settings WHERE key = 'geminiApiKey'").get();
const apiKey = row.value;

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "Me dê as notícias de hoje" }] }],
    tools: [
      { functionDeclarations: [{ name: "foo", description: "bar", parameters: { type: "object", properties: {}, required: [] } }] },
      { googleSearch: {} }
    ]
  })
}).then(r => r.json()).then(console.log).catch(console.error);
