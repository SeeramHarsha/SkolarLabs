/* Storage Manager for Offline Autosave/Autoresume */
const StorageManager = {
  SAVE_KEY: "metals_nonmetals_progress_v1",

  getDefaultState() {
    return {
      xp: 0,
      coins: 0,
      stars: 0,
      unlockedNodes: ["intro"],
      completedNodes: [],
      currentNode: "home",
      playerName: "Young Scientist",
      table4_1: {}, // Malleability Lab observations
      table4_2: {}, // Sonority Lab observations
      table4_3: {}, // Heat Lab observations
      table4_4: {}, // Electric Tester observations
      table4_5: {}, // Rusting observations
      litmusMg: null, // Basic nature test
      litmusSulfur: null, // Acidic nature test
      sulfurWaterReaction: null, // Reaction state
      metalsSortingScore: 0,
      propertyMatchingScore: 0,
      blacksmithForgedTools: [], // Knife, Pan, Axe, Spade
      rustPreventionScore: 0,
      missionsCompleted: [],
      achievements: [] // Badges list
    };
  },

  loadState() {
    try {
      const data = localStorage.getItem(this.SAVE_KEY);
      if (data) {
        // Merge defaults to handle schema upgrades smoothly
        return { ...this.getDefaultState(), ...JSON.parse(data) };
      }
    } catch (e) {
      console.error("Failed to read localStorage data", e);
    }
    return this.getDefaultState();
  },

  saveState(state) {
    try {
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to write to localStorage", e);
    }
  },

  clearState() {
    try {
      localStorage.removeItem(this.SAVE_KEY);
    } catch (e) {
      console.error("Failed to clear localStorage", e);
    }
    return this.getDefaultState();
  }
};
window.StorageManager = StorageManager;
