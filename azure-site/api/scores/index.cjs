// In-memory score cache (populated by push-scores, served to clients)
const shared = require("../shared.cjs");

module.exports = async function (context, req) {
  const data = shared.getScores();
  if (!data) {
    context.res = {
      status: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "No score data available yet. Waiting for Pi to push data." }),
    };
    return;
  }
  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
};
