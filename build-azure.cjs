// Build script: copies public site to azure-site with modifications for public hosting
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "public");
const dest = path.join(__dirname, "azure-site");

// Copy static folder
function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

console.log("Copying static assets...");
copyDir(path.join(src, "static"), path.join(dest, "static"));

// Copy PWA files
console.log("Copying PWA files...");
fs.copyFileSync(path.join(src, "manifest.json"), path.join(dest, "manifest.json"));
fs.copyFileSync(path.join(src, "sw.js"), path.join(dest, "sw.js"));

// Read and patch index.html
console.log("Patching index.html for public site...");
let html = fs.readFileSync(path.join(src, "index.html"), "utf8");

// Force detail-cycle mode (no config API on Azure)
html = html.replace(
  /try\s*\{\s*const cfgResp = await fetch\('\/api\/config'\);[\s\S]*?\} catch \{\}/,
  "displayMode = 'detail-cycle';"
);

// Remove admin cog link
html = html.replace(/<a href="\/admin\.html"[^>]*>.*?<\/a>/g, "");

// Update page title for public site
html = html.replace(
  /<title>.*?<\/title>/,
  "<title>Under the Glass – Pinball Leaderboard</title>"
);

fs.writeFileSync(path.join(dest, "index.html"), html);
console.log("Build complete!");
console.log(`  index.html: ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
