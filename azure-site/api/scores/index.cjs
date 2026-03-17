// Score cache with blob storage fallback for persistence
const shared = require("../shared.cjs");

module.exports = async function (context, req) {
  let data = shared.getScores();
  if (!data) {
    data = await shared.loadFromBlob();
  }
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
