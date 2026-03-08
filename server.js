// Comment Reply Bot — Proxy Server
// Proxies requests to Anthropic API to avoid CORS issues

const API_KEY = process.env.ANTHROPIC_API_KEY;

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 3000;

// Load database
let db = { keywordReplies: [], humanInterventionTriggers: { complaints: [], complexQuestions: [] } };
try {
  const dbPath = path.join(__dirname, "database.json");
  db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  console.log("✓ Database loaded");
} catch (e) {
  console.warn("⚠ Could not load database.json, using defaults");
}

// Check if a comment matches a keyword reply
function checkKeywordReply(comment) {
  const lower = comment.toLowerCase();
  for (const entry of db.keywordReplies) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return entry.reply;
      }
    }
  }
  return null;
}

// Check if a comment needs human intervention
function checkHumanIntervention(comment) {
  const lower = comment.toLowerCase();
  const allTriggers = [
    ...db.humanInterventionTriggers.complaints,
    ...db.humanInterventionTriggers.complexQuestions
  ];
  for (const trigger of allTriggers) {
    if (lower.includes(trigger.toLowerCase())) {
      return true;
    }
  }
  return false;
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve database.json to frontend
  if (req.method === "GET" && req.url === "/api/database") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(db));
    return;
  }

  // Check comments for keywords and human intervention
  if (req.method === "POST" && req.url === "/api/check-comments") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      const { comments } = JSON.parse(body);
      const results = comments.map(comment => ({
        comment,
        keywordReply: checkKeywordReply(comment),
        needsHuman: checkHumanIntervention(comment)
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(results));
    });
    return;
  }

  // Proxy API calls to Anthropic
  if (req.method === "POST" && req.url === "/api/messages") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(body),
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, { "Content-Type": "application/json" });
        proxyRes.pipe(res);
      });

      proxyReq.on("error", (e) => {
        console.error("Proxy error:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Proxy error: " + e.message } }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // Serve the HTML file
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    const filePath = path.join(__dirname, "comment-reply-bot.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("comment-reply-bot.html not found — make sure it's in the same folder as server.js");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log("─────────────────────────────────────");
  console.log(`  Comment Reply Bot running!`);
  console.log(`  Open: http://localhost:${PORT}`);
  console.log("─────────────────────────────────────");
});
