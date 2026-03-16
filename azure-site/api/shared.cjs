// Shared in-memory score store across Azure Functions
// Azure Static Web Apps runs functions in the same process,
// so module-level state is shared between function invocations.

let scoreData = null;

module.exports = {
  getScores() {
    return scoreData;
  },
  setScores(data) {
    scoreData = {
      ...data,
      _pushed_at: new Date().toISOString(),
    };
  },
};
