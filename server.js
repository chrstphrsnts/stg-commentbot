// Comment Reply Bot — Proxy Server
// Proxies requests to Anthropic API to avoid CORS issues
//
// SETUP:
//   1. Make sure Node.js is installed (https://nodejs.org)
//   2. Open this folder in VS Code terminal
//   3. Run: node server.js
//   4. Open http://localhost:3000 in your browser
//
// IMPORTANT: Put your Anthropic API key below (keep this file private!)

const API_KEY = process.env.ANTHROPIC_API_KEY;
// ─────────────────────────────────────────────
// No changes needed below this line
// ─────────────────────────────────────────────

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
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
