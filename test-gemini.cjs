fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
  method: "POST",
  headers: { "content-type": "application/json", "x-goog-api-key": "AIzaSyCyhBFLdXKoEk1tG5xcu8RvuKo_eeFFvYw" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "Me dê as notícias de hoje" }] }],
    tools: [{ googleSearch: {} }]
  })
}).then(r => r.json()).then(r => console.log(JSON.stringify(r))).catch(console.error);
