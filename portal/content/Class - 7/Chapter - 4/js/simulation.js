/* Virtual Lab & Physics Engine Simulation Engine */
const SimulationManager = {
  // Activity 4.1 Malleability variables
  malleabilityObj: "iron",
  malleabilityHits: 0,
  malleabilityDone: false,

  // Activity 4.2 Sonority variables
  sonorityObj: "spoon",

  // Activity 4.3 Heat variables
  heatSpoon: "metal", // metal or wood
  heatProgress: 0, // 0 to 100
  heatTimerId: null,
  heatTemp: 25,

  // Activity 4.4 Electric Tester
  electricObj: null,

  // Activity 4.5 Rusting Experiment
  rustDays: 0,
  rustTimerId: null,

  // Activity 4.6 Magnesium burning
  mgRibbonState: "normal", // normal, burning, powder, mixture
  mgSolutionTest: null, // red_turns_blue, blue_no_change

  // Activity 4.7 Sulfur burning
  sulfurState: "normal", // normal, burning, dissolved
  sulfurTest: null, // blue_turns_red, red_no_change

  // Spark particle array
  sparks: [],

  init() {
    this.resetActivity4_1();
    this.resetActivity4_3();
    this.resetActivity4_5();
  },

  /* --- 4.1 Malleability --- */
  resetActivity4_1() {
    this.malleabilityHits = 0;
    this.malleabilityDone = false;
    const stats = document.getElementById("m41-hits");
    if (stats) stats.innerText = "Hits: 0/4";
    const status = document.getElementById("m41-status");
    if (status) status.innerText = "Status: Intact";

    const metalEl = document.getElementById("malleability-target");
    if (metalEl) {
      metalEl.style.transform = "scale(1)";
      metalEl.style.borderRadius = "8px";
      metalEl.style.opacity = "1";
    }
  },

  selectMalleabilityObj(obj) {
    this.malleabilityObj = obj;
    this.resetActivity4_1();
    const target = document.getElementById("malleability-target");
    if (target) {
      target.className = `malleability-obj ${obj}`;
    }
  },

  hitHammer() {
    if (this.malleabilityDone) return;
    const hammer = document.getElementById("malleability-hammer");
    const target = document.getElementById("malleability-target");
    if (hammer) {
      hammer.classList.remove("hammer-active");
      void hammer.offsetWidth; // trigger reflow
      hammer.classList.add("hammer-active");
    }

    // Play Clanking/Forging Sound (Synth Sound)
    this.playSynthSound(this.malleabilityObj === "coal" || this.malleabilityObj === "sulfur" ? 180 : 440, "triangle", 0.15);

    // Create Canvas sparks if metal
    this.spawnSparks(this.malleabilityObj);

    this.malleabilityHits++;
    const stats = document.getElementById("m41-hits");
    if (stats) stats.innerText = `Hits: ${this.malleabilityHits}/4`;

    if (this.malleabilityHits >= 4) {
      this.malleabilityDone = true;
      this.resolveMalleabilityEffect(target);
    }
  },

  resolveMalleabilityEffect(target) {
    const status = document.getElementById("m41-status");
    const tableId = `m41_val_${this.malleabilityObj}`;
    const select = document.getElementById(tableId);

    if (this.malleabilityObj === "iron" || this.malleabilityObj === "copper" || this.malleabilityObj === "aluminium") {
      if (target) {
        target.style.transform = "scaleX(1.4) scaleY(0.4)";
      }
      if (status) status.innerText = "Status: Flattened into sheet! (Malleable)";
      if (select) select.value = "flattens";
      window.appState.table4_1[this.malleabilityObj] = "flattens";
    } else if (this.malleabilityObj === "coal" || this.malleabilityObj === "sulfur") {
      if (target) {
        target.style.opacity = "0.2";
      }
      if (status) status.innerText = "Status: Broken into pieces! (Brittle)";
      if (select) select.value = "breaks";
      window.appState.table4_1[this.malleabilityObj] = "breaks";
    } else {
      // Wood
      if (status) status.innerText = "Status: Intact (Neither flattened nor broken)";
      if (select) select.value = "no_change";
      window.appState.table4_1[this.malleabilityObj] = "no_change";
    }
    // Update and auto-save
    window.StorageManager.saveState(window.appState);
    this.checkMalleabilityCompletion();
  },

  checkMalleabilityCompletion() {
    const keys = ["copper", "aluminium", "iron", "coal", "sulfur", "wood"];
    const allDone = keys.every(k => window.appState.table4_1[k] !== undefined);
    if (allDone) {
      window.appState.xp += 50;
      window.appState.coins += 20;
      window.appState.completedNodes.push("activity4_1");
      if (!window.appState.unlockedNodes.includes("activity4_2")) {
        window.appState.unlockedNodes.push("activity4_2");
      }
      window.App.updateHeaderStats();
      window.StorageManager.saveState(window.appState);
      alert("Congratulations! Activity 4.1 observation table complete. Earned 50 XP & 20 Coins!");
    }
  },

  /* --- 4.2 Sonority --- */
  dropSonority(obj) {
    this.sonorityObj = obj;
    // Play realistic frequency tones based on sonorous properties
    const freqMap = {
      spoon: { freq: 1200, type: "sine", dur: 0.8 },
      coin: { freq: 1500, type: "sine", dur: 0.5 },
      wood: { freq: 150, type: "triangle", dur: 0.15 },
      coal: { freq: 80, type: "sawtooth", dur: 0.1 },
      glass: { freq: 900, type: "sine", dur: 0.3 }
    };

    const config = freqMap[obj] || { freq: 400, type: "sine", dur: 0.3 };
    this.playSynthSound(config.freq, config.type, config.dur);

    // Wave ripples animation
    const sandbox = document.getElementById("sonority-sandbox");
    if (sandbox) {
      const ripple = document.createElement("div");
      ripple.className = "ripple-effect";
      ripple.style.left = "50%";
      ripple.style.top = "70%";
      sandbox.appendChild(ripple);
      setTimeout(() => ripple.remove(), 1000);
    }

    // Set observation selection
    const tableId = `m42_val_${obj}`;
    const select = document.getElementById(tableId);
    const isSonorous = (obj === "spoon" || obj === "coin");
    if (select) {
      select.value = isSonorous ? "sonorous" : "non-sonorous";
      window.appState.table4_2[obj] = select.value;
      window.StorageManager.saveState(window.appState);
    }

    // Check complete
    const keys = ["spoon", "coin", "wood", "coal", "glass"];
    if (keys.every(k => window.appState.table4_2[k] !== undefined)) {
      window.appState.xp += 30;
      window.appState.completedNodes.push("activity4_2");
      if (!window.appState.unlockedNodes.includes("activity4_3")) {
        window.appState.unlockedNodes.push("activity4_3");
      }
      window.App.updateHeaderStats();
      window.StorageManager.saveState(window.appState);
    }
  },

  /* --- 4.3 Heat Conduction --- */
  resetActivity4_3() {
    if (this.heatTimerId) clearInterval(this.heatTimerId);
    this.heatProgress = 0;
    this.heatTemp = 25;
    this.updateHeatUI();
  },

  selectHeatSpoon(type) {
    this.heatSpoon = type;
    this.resetActivity4_3();
    const spoon = document.getElementById("heat-spoon-img");
    if (spoon) {
      spoon.className = `heat-spoon ${type}`;
    }
  },

  startHeatExperiment() {
    this.resetActivity4_3();
    const heatIndicator = document.getElementById("heat-flow-glow");
    if (heatIndicator && this.heatSpoon === "metal") {
      heatIndicator.classList.add("heat-active");
    }

    this.heatTimerId = setInterval(() => {
      this.heatProgress += 10;
      if (this.heatSpoon === "metal") {
        this.heatTemp = 25 + Math.round(this.heatProgress * 0.55);
      } else {
        this.heatTemp = 25 + Math.round(this.heatProgress * 0.05); // Wood transfers poorly
      }

      this.updateHeatUI();

      if (this.heatProgress >= 100) {
        clearInterval(this.heatTimerId);
        if (heatIndicator) heatIndicator.classList.remove("heat-active");
        this.resolveHeatConclusion();
      }
    }, 500);
  },

  updateHeatUI() {
    const tempVal = document.getElementById("heat-temp-val");
    const progressFill = document.getElementById("heat-progress-fill");
    if (tempVal) tempVal.innerText = `${this.heatTemp}°C`;
    if (progressFill) progressFill.style.width = `${this.heatProgress}%`;
  },

  resolveHeatConclusion() {
    const select = document.getElementById(`m43_val_${this.heatSpoon}`);
    if (select) {
      select.value = this.heatSpoon === "metal" ? "hotter" : "cooler";
      window.appState.table4_3[this.heatSpoon] = select.value;
      window.StorageManager.saveState(window.appState);
    }

    // Check complete
    if (window.appState.table4_3["metal"] && window.appState.table4_3["wood"]) {
      window.appState.xp += 30;
      window.appState.completedNodes.push("activity4_3");
      if (!window.appState.unlockedNodes.includes("activity4_4")) {
        window.appState.unlockedNodes.push("activity4_4");
      }
      window.App.updateHeaderStats();
      window.StorageManager.saveState(window.appState);
      alert("Conductors activity complete! Metals transfer heat rapidly, whereas non-metals/wood transfer heat poorly.");
    }
  },

  /* --- 4.4 Electric tester --- */
  testElectricity(obj) {
    this.electricObj = obj;
    const bulb = document.getElementById("tester-bulb");
    const lightBeam = document.getElementById("tester-light-beam");
    const label = document.getElementById("tester-classification");
    const select = document.getElementById(`m44_val_${obj}`);

    const isMetal = (obj === "aluminium" || obj === "iron" || obj === "copper");
    if (isMetal) {
      if (bulb) bulb.style.fill = "#ffeb3b";
      if (lightBeam) lightBeam.style.display = "block";
      if (label) label.innerText = "Classification: GOOD CONDUCTOR";
      if (select) select.value = "good";
      window.appState.table4_4[obj] = "good";
      this.playSynthSound(880, "sine", 0.2);
    } else {
      if (bulb) bulb.style.fill = "#4b5563";
      if (lightBeam) lightBeam.style.display = "none";
      if (label) label.innerText = "Classification: POOR CONDUCTOR";
      if (select) select.value = "poor";
      window.appState.table4_4[obj] = "poor";
    }

    window.StorageManager.saveState(window.appState);

    // Check complete
    const keys = ["aluminium", "iron", "sulfur", "copper", "coal", "wood", "stone", "eraser", "nylon"];
    if (keys.every(k => window.appState.table4_4[k] !== undefined)) {
      window.appState.xp += 40;
      window.appState.completedNodes.push("activity4_4");
      if (!window.appState.unlockedNodes.includes("activity4_5")) {
        window.appState.unlockedNodes.push("activity4_5");
      }
      window.App.updateHeaderStats();
      window.StorageManager.saveState(window.appState);
    }
  },

  /* --- 4.5 Rusting bottles --- */
  resetActivity4_5() {
    if (this.rustTimerId) clearInterval(this.rustTimerId);
    this.rustDays = 0;
    this.updateRustUI();
  },

  startRusting() {
    this.resetActivity4_5();
    this.rustTimerId = setInterval(() => {
      this.rustDays++;
      this.updateRustUI();

      if (this.rustDays >= 10) {
        clearInterval(this.rustTimerId);
        this.resolveRustConclusion();
      }
    }, 400);
  },

  updateRustUI() {
    const dayLabel = document.getElementById("rust-day-label");
    if (dayLabel) dayLabel.innerText = `Day: ${this.rustDays}/10`;

    // Visual changes on nails
    const nailA = document.getElementById("nail-a");
    const nailB = document.getElementById("nail-b");
    const nailC = document.getElementById("nail-c");

    if (nailA) nailA.style.filter = "none";
    if (nailB) nailB.style.filter = "none";

    // Nail C gets rusty brown
    if (nailC) {
      const amount = this.rustDays * 10;
      nailC.style.filter = `sepia(${amount}%) saturate(${amount * 2}%) hue-rotate(330deg)`;
    }
  },

  resolveRustConclusion() {
    const selA = document.getElementById("m45_val_a");
    const selB = document.getElementById("m45_val_b");
    const selC = document.getElementById("m45_val_c");

    if (selA) selA.value = "no_rust";
    if (selB) selB.value = "no_rust";
    if (selC) selC.value = "rusty";

    window.appState.table4_5["a"] = "no_rust";
    window.appState.table4_5["b"] = "no_rust";
    window.appState.table4_5["c"] = "rusty";

    window.appState.xp += 40;
    window.appState.completedNodes.push("activity4_5");
    if (!window.appState.unlockedNodes.includes("activity4_6")) {
      window.appState.unlockedNodes.push("activity4_6");
    }
    window.App.updateHeaderStats();
    window.StorageManager.saveState(window.appState);
    alert("Rusting experiment complete! Iron needs both Water and Air to rust.");
  },

  /* --- 4.6 Magnesium burning --- */
  burnMg() {
    this.mgRibbonState = "burning";
    const flame = document.getElementById("mg-flame");
    if (flame) flame.style.display = "block";
    this.playSynthSound(600, "triangle", 1.0);

    setTimeout(() => {
      if (flame) flame.style.display = "none";
      this.mgRibbonState = "powder";
      const ribbon = document.getElementById("mg-ribbon");
      if (ribbon) ribbon.style.backgroundColor = "#e5e7eb"; // turn white ash
      alert("Magnesium has burned with a dazzling white flame to form Magnesium Oxide (MgO) powder!");
    }, 1500);
  },

  testMgLitmus(color) {
    if (this.mgRibbonState !== "powder") {
      alert("Burn the Magnesium ribbon and dissolve it in water first!");
      return;
    }
    const indicator = document.getElementById("mg-indicator-status");
    if (color === "red") {
      this.mgSolutionTest = "basic";
      if (indicator) indicator.innerText = "Result: RED Litmus turned BLUE (Basic solution!)";
      window.appState.litmusMg = "basic";
    } else {
      if (indicator) indicator.innerText = "Result: BLUE Litmus remained BLUE (No change)";
    }
    window.StorageManager.saveState(window.appState);
    this.checkMgCompletion();
  },

  checkMgCompletion() {
    if (window.appState.litmusMg === "basic") {
      window.appState.xp += 30;
      window.appState.completedNodes.push("activity4_6");
      if (!window.appState.unlockedNodes.includes("activity4_7")) {
        window.appState.unlockedNodes.push("activity4_7");
      }
      window.App.updateHeaderStats();
      window.StorageManager.saveState(window.appState);
    }
  },

  /* --- 4.7 Sulfur burning --- */
  burnSulfur() {
    this.sulfurState = "burning";
    const flame = document.getElementById("sulfur-flame");
    if (flame) flame.style.display = "block";
    this.playSynthSound(250, "sawtooth", 1.2);

    setTimeout(() => {
      if (flame) flame.style.display = "none";
      this.sulfurState = "dissolved";
      alert("Sulfur burned forming Sulfur Dioxide (SO2) gas which is dissolved in water to make Sulfurous Acid.");
    }, 1500);
  },

  testSulfurLitmus(color) {
    if (this.sulfurState !== "dissolved") {
      alert("Burn the Sulfur and dissolve gas in water first!");
      return;
    }
    const indicator = document.getElementById("sulfur-indicator-status");
    if (color === "blue") {
      this.sulfurTest = "acidic";
      if (indicator) indicator.innerText = "Result: BLUE Litmus turned RED (Acidic solution!)";
      window.appState.litmusSulfur = "acidic";
    } else {
      if (indicator) indicator.innerText = "Result: RED Litmus remained RED (No change)";
    }
    window.StorageManager.saveState(window.appState);
    this.checkSulfurCompletion();
  },

  checkSulfurCompletion() {
    if (window.appState.litmusSulfur === "acidic") {
      window.appState.xp += 30;
      window.appState.completedNodes.push("activity4_7");
      if (!window.appState.unlockedNodes.includes("activity4_8")) {
        window.appState.unlockedNodes.push("activity4_8");
      }
      window.App.updateHeaderStats();
      window.StorageManager.saveState(window.appState);
    }
  },

  /* --- Helper sound generation --- */
  playSynthSound(freq, type, duration) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Web Audio API not supported or context block active", e);
    }
  },

  spawnSparks(material) {
    const isMetal = (material === "iron" || material === "copper" || material === "aluminium");
    if (!isMetal) return;

    const wrapper = document.querySelector(".view-section.active .lab-sandbox");
    if (!wrapper) return;

    for (let i = 0; i < 15; i++) {
      const spark = document.createElement("div");
      spark.className = "spark";
      spark.style.left = "50%";
      spark.style.top = "60%";

      const dx = (Math.random() - 0.5) * 200 + "px";
      const dy = (Math.random() - 0.7) * 150 + "px";
      spark.style.setProperty("--dx", dx);
      spark.style.setProperty("--dy", dy);

      wrapper.appendChild(spark);
      setTimeout(() => spark.remove(), 600);
    }
  }
};
window.SimulationManager = SimulationManager;
