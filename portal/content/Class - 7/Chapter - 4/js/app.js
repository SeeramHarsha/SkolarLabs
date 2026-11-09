/* Central Application Engine & Game Simulators */
const App = {
  init() {
    window.appState = window.StorageManager.loadState();
    this.updateHeaderStats();
    this.bindGlobalEvents();

    // Auto resume logic
    if (window.appState.currentNode && window.appState.currentNode !== "home") {
      window.NavigationManager.showView(window.appState.currentNode, false);
    } else {
      window.NavigationManager.showView("home", false);
    }

    // Set voice rate initial speed
    const voiceRate = document.getElementById("voice-rate");
    if (voiceRate) {
      voiceRate.value = window.VoiceManager.rate;
    }

    // Blacksmith Canvas Animation
    this.initFurnaceCanvas();
  },

  updateHeaderStats() {
    const xpVal = document.getElementById("header-xp");
    const coinVal = document.getElementById("header-coins");
    const starVal = document.getElementById("header-stars");

    if (xpVal) xpVal.innerText = window.appState.xp;
    if (coinVal) coinVal.innerText = window.appState.coins;
    if (starVal) starVal.innerText = window.appState.stars;
  },

  bindGlobalEvents() {
    // Dark mode toggle
    const themeBtn = document.getElementById("btn-theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const curTheme = document.body.getAttribute("data-theme");
        const nextTheme = curTheme === "light" ? "dark" : "light";
        document.body.setAttribute("data-theme", nextTheme);
        themeBtn.innerHTML = nextTheme === "light" ? "🌙" : "☀️";
      });
    }

    // Achievements modal
    const achBtn = document.getElementById("btn-achievements");
    if (achBtn) {
      achBtn.addEventListener("click", () => this.showAchievementsModal());
    }

    // Voice narrator buttons
    const playVoice = document.getElementById("voice-play");
    const pauseVoice = document.getElementById("voice-pause");
    const stopVoice = document.getElementById("voice-stop");
    const rateVoice = document.getElementById("voice-rate");

    if (playVoice) {
      playVoice.addEventListener("click", () => {
        const text = this.getNarrationTextForCurrentNode();
        window.VoiceManager.speak(text);
      });
    }
    if (pauseVoice) {
      pauseVoice.addEventListener("click", () => {
        window.VoiceManager.pause();
      });
    }
    if (stopVoice) {
      stopVoice.addEventListener("click", () => {
        window.VoiceManager.stop();
      });
    }
    if (rateVoice) {
      rateVoice.addEventListener("change", (e) => {
        window.VoiceManager.setRate(parseFloat(e.target.value));
      });
    }
  },

  getNarrationTextForCurrentNode() {
    const node = window.appState.currentNode;
    const element = document.getElementById(node);
    if (!element) return "";
    // Pull first few paragraph texts for narration
    const paragraphs = element.querySelectorAll("p, h1, h2");
    let text = "";
    paragraphs.forEach(p => {
      text += p.innerText + ". ";
    });
    return text.substring(0, 400); // cap text size for performance
  },

  showAchievementsModal() {
    const modal = document.getElementById("achievements-modal");
    if (!modal) return;
    modal.style.display = "flex";

    // Refresh unlocked status cards
    const badges = ["malleability", "sonority", "conductors", "rust_expert", "quiz_expert", "blacksmith_apprentice"];
    badges.forEach(b => {
      const card = document.getElementById(`ach-${b}`);
      if (card) {
        if (window.appState.completedNodes.includes("activity4_1") && b === "malleability") card.classList.add("unlocked");
        if (window.appState.completedNodes.includes("activity4_2") && b === "sonority") card.classList.add("unlocked");
        if (window.appState.completedNodes.includes("activity4_4") && b === "conductors") card.classList.add("unlocked");
        if (window.appState.completedNodes.includes("activity4_5") && b === "rust_expert") card.classList.add("unlocked");
        if (window.appState.completedNodes.includes("quiz") && b === "quiz_expert") card.classList.add("unlocked");
        if (window.appState.completedNodes.includes("blacksmith-simulator") && b === "blacksmith_apprentice") card.classList.add("unlocked");
      }
    });
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "none";
  },

  onViewChanged(nodeId) {
    // Refresh page specific details
    if (nodeId === "activity4_1") window.SimulationManager.selectMalleabilityObj("iron");
    if (nodeId === "activity4_3") window.SimulationManager.selectHeatSpoon("metal");
    if (nodeId === "activity4_5") window.SimulationManager.resetActivity4_5();
    if (nodeId === "quiz") window.QuizManager.init();
    if (nodeId === "certificate") this.renderCertificate();
  },

  renderCertificate() {
    const nameEl = document.getElementById("cert-name");
    const progressEl = document.getElementById("cert-progress");
    const xpEl = document.getElementById("cert-xp");
    const coinsEl = document.getElementById("cert-coins");

    if (nameEl) nameEl.innerText = window.appState.playerName;
    if (xpEl) xpEl.innerText = window.appState.xp;
    if (coinsEl) coinsEl.innerText = window.appState.coins;

    const completedCount = window.appState.completedNodes.length;
    const totalNodes = window.NavigationManager.nodes.length;
    const percent = Math.round((completedCount / totalNodes) * 100);
    if (progressEl) progressEl.innerText = `${percent}% Completion`;
  },

  updatePlayerName() {
    const nameInput = document.getElementById("player-name-input");
    if (nameInput && nameInput.value.trim() !== "") {
      window.appState.playerName = nameInput.value;
      window.StorageManager.saveState(window.appState);
      alert("Name updated!");
      this.renderCertificate();
    }
  },

  printCertificate() {
    window.print();
  },

  restartChapter() {
    if (confirm("Are you sure you want to reset all progress and start over?")) {
      window.appState = window.StorageManager.clearState();
      this.updateHeaderStats();
      window.NavigationManager.showView("home");
    }
  },

  /* --- Canvas Forge Sparks --- */
  initFurnaceCanvas() {
    const canvas = document.getElementById("furnace-sparks-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let sparks = [];

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw fire base
      ctx.fillStyle = "rgba(255, 87, 34, 0.2)";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height, 60, 0, Math.PI, true);
      ctx.fill();

      // Emit new particles randomly
      if (Math.random() < 0.2) {
        sparks.push({
          x: canvas.width / 2 + (Math.random() - 0.5) * 40,
          y: canvas.height - 20,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 5 - 2,
          life: 1.0,
          decay: Math.random() * 0.02 + 0.01
        });
      }

      // Update and draw particles
      sparks.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) {
          sparks.splice(index, 1);
          return;
        }

        ctx.fillStyle = `rgba(255, 152, 0, ${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(animate);
    }
    animate();
  },

  /* --- Game 1: Metals vs Non-Metals --- */
  dragSortGame(e) {
    e.dataTransfer.setData("text", e.target.id);
  },

  dropSortGame(e, targetGroup) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text");
    const el = document.getElementById(id);
    if (!el) return;

    const metalItems = ["sort-copper", "sort-iron", "sort-gold", "sort-silver", "sort-aluminium"];
    const nonMetalItems = ["sort-oxygen", "sort-carbon", "sort-sulfur", "sort-nitrogen", "sort-hydrogen", "sort-chlorine"];

    let correct = false;
    if (targetGroup === "metal" && metalItems.includes(id)) correct = true;
    if (targetGroup === "nonmetal" && nonMetalItems.includes(id)) correct = true;

    if (correct) {
      window.appState.xp += 10;
      this.updateHeaderStats();
      e.currentTarget.appendChild(el);
      el.style.backgroundColor = "rgba(16, 185, 129, 0.3)";
      window.SimulationManager.playSynthSound(600, "sine", 0.1);
    } else {
      el.style.backgroundColor = "rgba(239, 68, 68, 0.3)";
      window.SimulationManager.playSynthSound(150, "sawtooth", 0.25);
    }
    window.StorageManager.saveState(window.appState);
  },

  /* --- Game 2: Property Matching Game --- */
  checkPropertyMatch(prop, example) {
    const correctMap = {
      lustre: "gold",
      malleability: "foil",
      ductility: "wire",
      sonority: "bell",
      heat: "pan",
      electric: "copper_wire",
      corrosion: "rust"
    };

    const status = document.getElementById(`prop-match-status-${prop}`);
    if (correctMap[prop] === example) {
      if (status) {
        status.innerText = "✓ Match!";
        status.style.color = "var(--accent-green)";
      }
      window.appState.xp += 15;
      this.updateHeaderStats();
      window.SimulationManager.playSynthSound(800, "sine", 0.1);
    } else {
      if (status) {
        status.innerText = "✗ Incorrect";
        status.style.color = "var(--accent-red)";
      }
      window.SimulationManager.playSynthSound(200, "triangle", 0.2);
    }
    window.StorageManager.saveState(window.appState);
  },

  /* --- Game 3: Blacksmith Simulator --- */
  heatSimulatorIron() {
    const metal = document.getElementById("sim-iron-bar");
    if (!metal) return;

    metal.style.backgroundColor = "#ef4444";
    metal.style.boxShadow = "0 0 25px #ef4444";
    window.SimulationManager.playSynthSound(300, "sawtooth", 1.0);
    metal.dataset.hot = "true";
  },

  hammerSimulatorIron(shape) {
    const metal = document.getElementById("sim-iron-bar");
    if (!metal || metal.dataset.hot !== "true") {
      alert("Heat the metal block in the furnace first until it glows red hot!");
      return;
    }

    // Recoil hammer
    const ham = document.getElementById("sim-hammer");
    if (ham) {
      ham.classList.remove("hammer-active");
      void ham.offsetWidth;
      ham.classList.add("hammer-active");
    }

    window.SimulationManager.playSynthSound(440, "triangle", 0.25);
    window.SimulationManager.spawnSparks("iron");

    // Add tool
    if (!window.appState.blacksmithForgedTools.includes(shape)) {
      window.appState.blacksmithForgedTools.push(shape);
      window.appState.xp += 40;
      window.appState.coins += 20;
      this.updateHeaderStats();
      window.StorageManager.saveState(window.appState);

      const gallery = document.getElementById("sim-forged-gallery");
      if (gallery) {
        const item = document.createElement("div");
        item.className = "stat-item";
        item.innerText = `🛠 ${shape.toUpperCase()}`;
        gallery.appendChild(item);
      }
    }
  },

  resetSimulator() {
    const metal = document.getElementById("sim-iron-bar");
    if (metal) {
      metal.style.backgroundColor = "";
      metal.style.boxShadow = "";
      metal.dataset.hot = "false";
    }

    window.appState.blacksmithForgedTools = [];
    window.StorageManager.saveState(window.appState);

    const gallery = document.getElementById("sim-forged-gallery");
    if (gallery) gallery.innerHTML = "";
  },

  /* --- Game 4: Rust Protection --- */
  applyProtection(method) {
    const status = document.getElementById("rust-protection-status");
    if (status) {
      status.innerText = `Applied protection: ${method.toUpperCase()}!`;
    }
    const bridge = document.getElementById("sim-bridge");
    if (bridge) {
      if (method === "paint") bridge.style.borderColor = "var(--accent-blue)";
      if (method === "galvanization") bridge.style.borderColor = "var(--accent-gold)";
    }
    this.lastProtectionMethod = method;
  },

  testRustProtection() {
    if (!this.lastProtectionMethod) {
      alert("Apply a protection method (Paint, Oil, or Galvanization) first!");
      return;
    }

    const bridge = document.getElementById("sim-bridge");
    const result = document.getElementById("rust-protection-result");

    // Simulate storm
    window.SimulationManager.playSynthSound(100, "sawtooth", 1.5);

    setTimeout(() => {
      if (this.lastProtectionMethod === "galvanization") {
        if (result) result.innerText = "Bridge completely protected! Galvanization (Zinc coating) prevents rusting perfectly. +50 XP!";
        if (result) result.style.color = "var(--accent-green)";
        window.appState.xp += 50;
      } else if (this.lastProtectionMethod === "paint" || this.lastProtectionMethod === "oil") {
        if (result) result.innerText = "Partially protected. Good for immediate barriers, but might wear off.";
        if (result) result.style.color = "var(--accent-gold)";
        window.appState.xp += 20;
      }
      this.updateHeaderStats();
      window.StorageManager.saveState(window.appState);
    }, 1500);
  },

  /* --- Real Life Missions --- */
  completeMission(id, answer) {
    const status = document.getElementById(`mission-status-${id}`);
    const correctMap = {
      1: "iron",
      2: "metal",
      3: "copper",
      4: "galvanization"
    };

    if (correctMap[id] === answer) {
      if (status) {
        status.innerText = "Mission Complete! Correct Choice.";
        status.style.color = "var(--accent-green)";
      }
      window.appState.xp += 30;
      this.updateHeaderStats();
      window.SimulationManager.playSynthSound(600, "sine", 0.1);
    } else {
      if (status) {
        status.innerText = "Incorrect Choice. Try another material!";
        status.style.color = "var(--accent-red)";
      }
      window.SimulationManager.playSynthSound(200, "triangle", 0.2);
    }
    window.StorageManager.saveState(window.appState);
  }
};
window.App = App;
window.addEventListener("DOMContentLoaded", () => App.init());
