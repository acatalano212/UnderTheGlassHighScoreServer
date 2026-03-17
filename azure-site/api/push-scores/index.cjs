// Receives score data pushed from the Pi server
const shared = require("../shared.cjs");

module.exports = async function (context, req) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 204 };
    return;
  }

  // Verify API key
  const apiKey = req.headers["x-api-key"] || "";
  const expectedKey = process.env.UTG_PUSH_KEY || "utg-default-key-change-me";
  if (apiKey !== expectedKey) {
    context.res = {
      status: 401,
      body: JSON.stringify({ error: "Invalid API key" }),
    };
    return;
  }

  try {
    const data = req.body;
    if (!data || typeof data !== 'object' || !data.games || typeof data.games !== 'object') {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "Missing or invalid games data" }),
      };
      return;
    }

    await shared.setScores(data);

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ok",
        games_count: Object.keys(data.games).length,
        received_at: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error("Push scores error:", err);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to process score data: " + err.message }),
    };
  }
};
