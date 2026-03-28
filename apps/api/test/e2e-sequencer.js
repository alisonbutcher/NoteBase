const Sequencer = require('@jest/test-sequencer').default;

class E2ESequencer extends Sequencer {
  sort(tests) {
    // health check first, then everything else alphabetically
    return [...tests].sort((a, b) => {
      const aIsHealth = a.path.includes('health');
      const bIsHealth = b.path.includes('health');
      if (aIsHealth && !bIsHealth) return -1;
      if (!aIsHealth && bIsHealth) return 1;
      return a.path.localeCompare(b.path);
    });
  }
}

module.exports = E2ESequencer;
