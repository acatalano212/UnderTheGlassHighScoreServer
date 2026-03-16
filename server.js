/**
 * Under the Glass — High Score Server (Express.js)
 * Self-hosted pinball leaderboard for Raspberry Pi.
 * Combines Stern Insider Connected API data with local JJP/other scores.
 */

import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Request logging for API calls
app.use("/api", (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms [${req.ip}]`);
  });
  next();
});

app.use(express.static(join(__dirname, "public")));

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const STERN_LEADERBOARD_URL = "https://api.prd.sternpinball.io/api/v1/portal/leaderboards/";
const STERN_GAME_TITLES_URL = "https://cms.prd.sternpinball.io/api/v1/portal/game_titles/";
const CACHE_TTL = 300_000; // 5 minutes

const DATA_DIR = join(__dirname, "data");
const SCORES_FILE = join(DATA_DIR, "scores.json");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// Runtime config (persisted to data/config.json)
const CONFIG_FILE = join(DATA_DIR, "config.json");

function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {}
  return {};
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

let runtimeConfig = loadConfig();

// ---------------------------------------------------------------------------
// Score persistence
// ---------------------------------------------------------------------------
const sternCache = {};

function loadScores() {
  try {
    if (existsSync(SCORES_FILE)) {
      const raw = readFileSync(SCORES_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.warn("Failed to load scores file, starting fresh:", e.message);
  }
  return new Map();
}

function saveScores(scoresMap) {
  const obj = Object.fromEntries(scoresMap);
  writeFileSync(SCORES_FILE, JSON.stringify(obj, null, 2), "utf-8");
}

const JJP_COLORS = ["#740001","#ae0001","#eeba30","#1a472a","#2a623d","#222f5b","#5d5d5d"];

// Initialize scores from file, seed if empty
const jjpScores = loadScores();
if (jjpScores.size === 0) {
  seedMockScores();
  saveScores(jjpScores);
  console.log("Seeded initial scores to", SCORES_FILE);
}

// ---------------------------------------------------------------------------
// Seed mock scores
// ---------------------------------------------------------------------------

function seedMockScores() {
  const mockGames = [
    {
      machine_id: "jjp-hp-we", game: "Harry Potter", manufacturer: "Jersey Jack Pinball",
      edition: "Wizard Edition", games_played: 251,
      scores: [
        { username: "ANTHONY", score: 529598635 }, { username: "GINNY", score: 478320100 },
        { username: "SIRIUS", score: 412890500 }, { username: "LUPIN", score: 367450200 },
        { username: "TONKS", score: 298760400 }, { username: "HAGRID", score: 245130800 },
        { username: "DOBBY", score: 198540300 }, { username: "NEVILLE", score: 156780600 },
        { username: "LUNA", score: 134290100 }, { username: "DRACO", score: 112450700 },
      ],
    },
    {
      machine_id: "jjp-hp-ce", game: "Harry Potter", manufacturer: "Jersey Jack Pinball",
      edition: "Collectors Edition", games_played: 87,
      scores: [
        { username: "HARRY", score: 412750200 }, { username: "HERMIONE", score: 389120500 },
        { username: "RON", score: 245890100 }, { username: "DUMBLEDORE", score: 198450300 },
        { username: "SNAPE", score: 156720800 }, { username: "MCGONAGALL", score: 134560200 },
        { username: "HAGRID", score: 112340600 }, { username: "DOBBY", score: 98760100 },
        { username: "NEVILLE", score: 87430500 }, { username: "LUNA", score: 76210300 },
      ],
    },
    {
      machine_id: "jjp-avatar", game: "Avatar", manufacturer: "Jersey Jack Pinball",
      edition: "Collectors Edition", games_played: 143,
      scores: [
        { username: "JAKE", score: 876540200 }, { username: "NEYTIRI", score: 654320100 },
        { username: "QUARITCH", score: 523180400 }, { username: "GRACE", score: 412760300 },
        { username: "TRUDY", score: 298540100 }, { username: "NORM", score: 245130600 },
        { username: "MOAT", score: 198760200 }, { username: "TSUTY", score: 156430500 },
        { username: "EYTUKAN", score: 123890100 }, { username: "SELFRIDGE", score: 98540300 },
      ],
    },
    {
      machine_id: "jjp-godfather", game: "The Godfather", manufacturer: "Jersey Jack Pinball",
      edition: "Collectors Edition", games_played: 205,
      scores: [
        { username: "MICHAEL", score: 745230600 }, { username: "VITO", score: 632890100 },
        { username: "SONNY", score: 498760300 }, { username: "FREDO", score: 287430500 },
        { username: "TOM", score: 215670200 }, { username: "KAY", score: 187340100 },
        { username: "CONNIE", score: 156890400 }, { username: "CARLO", score: 134560200 },
        { username: "CLEMENZA", score: 112780600 }, { username: "TESSIO", score: 98430100 },
      ],
    },
    {
      machine_id: "jjp-toystory4", game: "Toy Story 4", manufacturer: "Jersey Jack Pinball",
      edition: "Collectors Edition", games_played: 312,
      scores: [
        { username: "WOODY", score: 567890400 }, { username: "BUZZ", score: 489230100 },
        { username: "BONNIE", score: 345670200 }, { username: "FORKY", score: 278910600 },
        { username: "BOPEP", score: 198760300 }, { username: "JESSIE", score: 167430500 },
        { username: "REX", score: 145890200 }, { username: "HAMM", score: 123560100 },
        { username: "SLINKY", score: 98740600 }, { username: "DUCKY", score: 87230400 },
      ],
    },
    {
      machine_id: "jjp-eltonjohn", game: "Elton John", manufacturer: "Jersey Jack Pinball",
      edition: "Collectors Edition", games_played: 178,
      scores: [
        { username: "ELTON", score: 923450100 }, { username: "BERNIE", score: 712340500 },
        { username: "ROCKET", score: 534210300 }, { username: "DANCER", score: 423180200 },
        { username: "CROC", score: 312450600 }, { username: "TARON", score: 267890100 },
        { username: "CAPTAIN", score: 234560400 }, { username: "ISLAND", score: 198730200 },
        { username: "BENNIE", score: 156890500 }, { username: "PINBALL", score: 134210300 },
      ],
    },
    {
      machine_id: "jjp-potc", game: "Pirates of the Caribbean", manufacturer: "Jersey Jack Pinball",
      edition: "Collectors Edition", games_played: 196,
      scores: [
        { username: "JACK", score: 834560200 }, { username: "BARBOSSA", score: 712340100 },
        { username: "WILL", score: 598760400 }, { username: "ELIZABETH", score: 467230300 },
        { username: "DAVY", score: 356890100 }, { username: "GIBBS", score: 289450600 },
        { username: "TIADALMA", score: 234780200 }, { username: "NORRINGTN", score: 187650500 },
        { username: "RAGETTI", score: 145230100 }, { username: "PINTEL", score: 112890300 },
      ],
    },
    {
      machine_id: "jjp-gnr", game: "Guns N' Roses", manufacturer: "Jersey Jack Pinball",
      edition: "Limited Edition", games_played: 167,
      scores: [
        { username: "AXL", score: 912340500 }, { username: "SLASH", score: 789560200 },
        { username: "DUFF", score: 634210100 }, { username: "IZZY", score: 523890400 },
        { username: "STEVEN", score: 412670300 }, { username: "DIZZY", score: 356780100 },
        { username: "GILBY", score: 289340600 }, { username: "MATT", score: 234560200 },
        { username: "BUCKHD", score: 187890500 }, { username: "BUMBLFT", score: 145230100 },
      ],
    },
    {
      machine_id: "bof-wmh", game: "Winchester Mystery House", manufacturer: "Barrels of Fun",
      edition: "", games_played: 52,
      scores: [
        { username: "SARAH", score: 645230100 }, { username: "SPIRIT", score: 523890400 },
        { username: "GHOST", score: 412670200 }, { username: "HAUNT", score: 298540300 },
        { username: "SEANCE", score: 187430500 },
      ],
    },
    {
      machine_id: "spooky-bj", game: "Beetlejuice", manufacturer: "Spooky Pinball",
      edition: "", games_played: 89,
      scores: [
        { username: "BEETLE", score: 723450600 }, { username: "LYDIA", score: 612340100 },
        { username: "ADAM", score: 498760300 }, { username: "BARB", score: 387430200 },
        { username: "DELIA", score: 276890500 },
      ],
    },
    {
      machine_id: "stern-dnd", game: "Dungeons & Dragons", manufacturer: "Stern Pinball",
      edition: "Pro", games_played: 134,
      scores: [
        { username: "WIZARD", score: 834560200 }, { username: "RANGER", score: 712340100 },
        { username: "ROGUE", score: 598760400 }, { username: "CLERIC", score: 467230300 },
        { username: "BARD", score: 356890100 },
      ],
    },
    {
      machine_id: "stern-pokemon", game: "Pokémon", manufacturer: "Stern Pinball",
      edition: "Limited Edition", games_played: 201,
      scores: [
        { username: "ASH", score: 945670300 }, { username: "PIKACHU", score: 823450100 },
        { username: "MISTY", score: 712340600 }, { username: "BROCK", score: 598760200 },
        { username: "GARY", score: 467890400 },
      ],
    },
    {
      machine_id: "cgc-mm", game: "Medieval Madness", manufacturer: "Chicago Gaming",
      edition: "Merlin Edition", games_played: 276,
      scores: [
        { username: "KNIGHT", score: 1234560200 }, { username: "MERLIN", score: 987430100 },
        { username: "DRAGON", score: 756890400 }, { username: "KING", score: 623450300 },
        { username: "TROLL", score: 498760100 },
      ],
    },
    {
      machine_id: "bof-dune", game: "Dune", manufacturer: "Barrels of Fun",
      edition: "", games_played: 118,
      scores: [
        { username: "PAUL", score: 876540200 }, { username: "CHANI", score: 723450100 },
        { username: "STILGAR", score: 612340600 }, { username: "JESSICA", score: 498760300 },
        { username: "LETO", score: 387430200 },
      ],
    },
    {
      machine_id: "stern-metallica", game: "Metallica Remastered", manufacturer: "Stern Pinball",
      edition: "Premium", games_played: 189,
      scores: [
        { username: "JAMES", score: 1123450600 }, { username: "LARS", score: 934560200 },
        { username: "KIRK", score: 756890100 }, { username: "ROB", score: 623450400 },
        { username: "CLIFF", score: 498760300 },
      ],
    },
    {
      machine_id: "stern-godzilla", game: "Godzilla", manufacturer: "Stern Pinball",
      edition: "Premium", games_played: 156,
      scores: [
        { username: "GOJIRA", score: 1345670200 }, { username: "MOTHRA", score: 1098760100 },
        { username: "RODAN", score: 876540400 }, { username: "GHIDRA", score: 723450300 },
        { username: "KONG", score: 598760100 },
      ],
    },
    {
      machine_id: "stern-jaws", game: "Jaws", manufacturer: "Stern Pinball",
      edition: "50th Anniversary Edition", games_played: 143,
      scores: [
        { username: "BRODY", score: 967890200 }, { username: "QUINT", score: 834560100 },
        { username: "HOOPER", score: 712340600 }, { username: "ELLEN", score: 598760300 },
        { username: "SHARK", score: 467890200 },
      ],
    },
  ];

  for (const g of mockGames) {
    const scores = g.scores.map((s, i) => ({
      username: s.username,
      avatar_path: "",
      background_color_hex: JJP_COLORS[i % JJP_COLORS.length],
      score: s.score,
      is_all_access: false,
    }));
    jjpScores.set(g.machine_id, {
      game: g.game,
      manufacturer: g.manufacturer || "",
      edition: g.edition || "",
      scores,
      games_played: g.games_played,
      primary_background: "",
      square_logo: "",
      updated: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Stern data helpers
// ---------------------------------------------------------------------------
async function cachedGet(url, key) {
  const now = Date.now();
  if (sternCache[key] && now - sternCache[key].ts < CACHE_TTL) {
    return sternCache[key].data;
  }
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    sternCache[key] = { ts: now, data };
    return data;
  } catch (e) {
    console.warn(`Failed to fetch ${url}:`, e.message);
    return sternCache[key]?.data ?? null;
  }
}

async function loadSternData() {
  const eventCode = runtimeConfig.sternEventCode || process.env.STERN_EVENT_CODE || "VaTQ-MRMSP-uJe";
  const lbUrl = `${STERN_LEADERBOARD_URL}?event_code=${eventCode}&event_state=current`;

  const [lbJson, titlesJson] = await Promise.all([
    cachedGet(lbUrl, "stern_lb"),
    cachedGet(STERN_GAME_TITLES_URL, "stern_titles"),
  ]);

  const titleAssets = {};
  if (titlesJson) {
    const items = Array.isArray(titlesJson) ? titlesJson : (titlesJson.results || titlesJson.data || []);
    for (const t of items) {
      if (t && t.code) {
        titleAssets[t.code] = {
          name: t.name || "",
          primary_background: t.primary_background || "",
          square_logo: t.square_logo || "",
        };
      }
    }
  }

  const STERN_EDITIONS = {
    DED: "Pro", FOO: "Pro", SKK: "Premium", RSH: "Limited Edition",
    SW2: "Pro", STR: "Pro", VEN: "Pro",
  };

  const games = {};

  if (lbJson?.leaderboard) {
    const lb = lbJson.leaderboard;
    const titleCodeMap = {};
    for (const t of lb.titles || []) {
      titleCodeMap[t.title_name || ""] = t.title_code || "";
    }

    for (const s of lb.scores || []) {
      const tname = s.title_name || "Unknown";
      const tcode = titleCodeMap[tname] || "";
      const asset = titleAssets[tcode] || {};

      if (!games[tname]) {
        games[tname] = {
          title_code: tcode,
          display_name: asset.name || tname,
          manufacturer: "Stern Pinball",
          edition: STERN_EDITIONS[tcode] || "",
          primary_background: asset.primary_background || "",
          square_logo: asset.square_logo || "",
          source: "stern",
          scores: [],
          updated: sternCache["stern_lb"]
            ? new Date(sternCache["stern_lb"].ts).toISOString()
            : new Date().toISOString(),
        };
      }

      games[tname].scores.push({
        username: s.username || "?",
        avatar_path: s.avatar_path || "",
        background_color_hex: s.background_color_hex || "#888",
        score: parseInt(s.score) || 0,
        is_all_access: s.is_all_accesss ?? s.is_all_access ?? false,
      });
    }

    for (const g of Object.values(games)) {
      g.scores.sort((a, b) => b.score - a.score);
    }
  }

  return games;
}

function loadJjpData() {
  const games = {};
  for (const [machineId, data] of jjpScores) {
    games[machineId] = {
      title_code: machineId,
      display_name: data.game || machineId,
      manufacturer: data.manufacturer || "Jersey Jack Pinball",
      edition: data.edition || "",
      primary_background: data.primary_background || "",
      square_logo: data.square_logo || "",
      source: "jjp",
      machine_id: machineId,
      scores: data.scores || [],
      games_played: data.games_played || 0,
      updated: data.updated || "",
    };
  }
  return games;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// GET /api/scores — combined leaderboard
app.get("/api/scores", async (req, res) => {
  const sternGames = await loadSternData();
  const jjpGames = loadJjpData();

  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });

  res.json({
    leaderboard: {
      title: `${monthName} ${now.getFullYear()} Leaderboard`,
      date_range: `${monthName}-1 to ${monthName} 31st`,
    },
    games: { ...jjpGames, ...sternGames },
    updated: now.toISOString(),
  });
});

// POST /api/scores — receive score submissions (ESP32 or admin)
app.post("/api/scores", (req, res) => {
  const apiKey = process.env.UTG_API_KEY || "";
  const providedKey = req.headers["x-api-key"] || "";
  if (!apiKey || providedKey !== apiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body;
  const machineId = body.machine_id;
  if (!machineId) {
    return res.status(400).json({ error: "machine_id required" });
  }

  const highScores = body.high_scores || [];
  const seen = new Set();
  const scores = [];
  const defaultColors = ["#740001","#ae0001","#eeba30","#1a472a","#2a623d","#222f5b","#5d5d5d"];

  for (const entry of highScores) {
    let initials = (entry.initials || "???").toUpperCase().trim();
    if (initials === "ANTHOY") initials = "ANTHONY";
    if (!seen.has(initials)) {
      seen.add(initials);
      scores.push({
        username: initials,
        avatar_path: "",
        background_color_hex: defaultColors[scores.length % defaultColors.length],
        score: parseInt(entry.score) || 0,
        is_all_access: false,
      });
    }
  }
  scores.sort((a, b) => b.score - a.score);

  const existing = jjpScores.get(machineId) || {};
  jjpScores.set(machineId, {
    game: body.game || existing.game || "Unknown",
    manufacturer: body.manufacturer || existing.manufacturer || "",
    edition: body.edition || existing.edition || "",
    scores,
    games_played: body.games_played || existing.games_played || 0,
    primary_background: body.primary_background || existing.primary_background || "",
    square_logo: body.square_logo || existing.square_logo || "",
    updated: new Date().toISOString(),
  });

  saveScores(jjpScores);
  console.log(`Updated scores for ${machineId}: ${scores.length} entries`);

  res.json({ status: "ok", machine_id: machineId, scores_count: scores.length });
});

// PUT /api/scores/:machineId — admin update scores for a specific game
app.put("/api/scores/:machineId", (req, res) => {
  const { machineId } = req.params;
  const existing = jjpScores.get(machineId);
  if (!existing) {
    return res.status(404).json({ error: "Game not found" });
  }

  const body = req.body;
  if (body.scores) {
    existing.scores = body.scores;
  }
  if (body.games_played !== undefined) {
    existing.games_played = body.games_played;
  }
  existing.updated = new Date().toISOString();

  jjpScores.set(machineId, existing);
  saveScores(jjpScores);

  res.json({ status: "ok", machine_id: machineId });
});

// ---------------------------------------------------------------------------
// Config API (admin settings)
// ---------------------------------------------------------------------------

// GET /api/config — get runtime config
app.get("/api/config", (req, res) => {
  res.json({
    sternEventCode: runtimeConfig.sternEventCode || process.env.STERN_EVENT_CODE || "VaTQ-MRMSP-uJe",
  });
});

// PUT /api/config — update runtime config
app.put("/api/config", (req, res) => {
  const body = req.body;
  if (body.sternEventCode !== undefined) {
    runtimeConfig.sternEventCode = body.sternEventCode.trim();
    // Clear Stern cache so next fetch uses new code
    delete sternCache["stern_lb"];
  }
  saveConfig(runtimeConfig);
  res.json({ status: "ok", config: runtimeConfig });
});

// ---------------------------------------------------------------------------
// WiFi management (Linux/Pi only)
// ---------------------------------------------------------------------------

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

// GET /api/wifi/status — current connection info
app.get("/api/wifi/status", async (req, res) => {
  try {
    const [ssid, ip, signal] = await Promise.all([
      execPromise("iwgetid -r").catch(() => "Not connected"),
      execPromise("hostname -I").catch(() => "Unknown"),
      execPromise("iwconfig wlan0 2>/dev/null | grep -o 'Signal level=.*' || echo 'N/A'").catch(() => "N/A"),
    ]);
    res.json({
      ssid,
      ip: ip.split(" ")[0] || "Unknown",
      signal: signal.replace("Signal level=", "").trim(),
      hostname: process.env.HOSTNAME || "utg-kiosk",
    });
  } catch (e) {
    res.json({ ssid: "N/A (not on Linux)", ip: "N/A", signal: "N/A", hostname: "N/A" });
  }
});

// GET /api/wifi/scan — list available networks
app.get("/api/wifi/scan", async (req, res) => {
  try {
    const raw = await execPromise("nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list --rescan yes");
    const networks = raw.split("\n").filter(Boolean).map((line) => {
      const [ssid, signal, security] = line.split(":");
      return { ssid, signal: parseInt(signal) || 0, security: security || "Open" };
    }).filter((n) => n.ssid);

    // Deduplicate by SSID, keep strongest signal
    const unique = new Map();
    for (const n of networks) {
      if (!unique.has(n.ssid) || unique.get(n.ssid).signal < n.signal) {
        unique.set(n.ssid, n);
      }
    }
    res.json([...unique.values()].sort((a, b) => b.signal - a.signal));
  } catch (e) {
    res.status(500).json({ error: "WiFi scan not available: " + e.message });
  }
});

// POST /api/wifi/connect — connect to a network
app.post("/api/wifi/connect", async (req, res) => {
  const { ssid, password } = req.body;
  if (!ssid) return res.status(400).json({ error: "SSID required" });

  try {
    const cmd = password
      ? `nmcli dev wifi connect "${ssid}" password "${password}"`
      : `nmcli dev wifi connect "${ssid}"`;
    await execPromise(cmd);
    const ip = await execPromise("hostname -I").catch(() => "Unknown");
    res.json({ status: "connected", ssid, ip: ip.split(" ")[0] });
  } catch (e) {
    res.status(500).json({ error: "Failed to connect: " + e.message });
  }
});

// GET /api/wifi/saved — list saved networks
app.get("/api/wifi/saved", async (req, res) => {
  try {
    const raw = await execPromise("nmcli -t -f NAME,TYPE connection show");
    const wifi = raw.split("\n").filter(Boolean)
      .map((l) => l.split(":"))
      .filter(([, type]) => type === "802-11-wireless")
      .map(([name]) => name);
    res.json(wifi);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/wifi/:ssid — forget a saved network
app.delete("/api/wifi/:ssid", async (req, res) => {
  try {
    await execPromise(`nmcli connection delete "${req.params.ssid}"`);
    res.json({ status: "deleted", ssid: req.params.ssid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// System info
// ---------------------------------------------------------------------------
app.get("/api/system", async (req, res) => {
  try {
    const [uptime, temp, mem] = await Promise.all([
      execPromise("uptime -p").catch(() => "N/A"),
      execPromise("vcgencmd measure_temp 2>/dev/null || echo 'N/A'").catch(() => "N/A"),
      execPromise("free -h | awk '/Mem:/{print $3\"/\"$2}'").catch(() => "N/A"),
    ]);
    res.json({
      uptime,
      temperature: temp.replace("temp=", ""),
      memory: mem,
      nodeVersion: process.version,
    });
  } catch {
    res.json({ uptime: "N/A", temperature: "N/A", memory: "N/A", nodeVersion: process.version });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const server = await app.listen(PORT, "0.0.0.0");
console.log(`🎯 Under the Glass server running on http://0.0.0.0:${PORT}`);
console.log(`   Dashboard: http://localhost:${PORT}/`);
console.log(`   Admin:     http://localhost:${PORT}/admin.html`);
