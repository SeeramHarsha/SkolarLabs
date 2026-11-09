/* SPA Route and Navigation Manager */
const NavigationManager = {
  // Navigation structure mapping views
  nodes: [
    "home",
    "chapter-map",
    "intro",
    "activity4_1",
    "activity4_2",
    "activity4_3",
    "activity4_4",
    "activity4_5",
    "activity4_6",
    "activity4_7",
    "activity4_8",
    "metals-vs-nonmetals",
    "property-matching",
    "blacksmith-simulator",
    "rust-protection",
    "missions",
    "science-society",
    "holistic-lens",
    "projects",
    "quiz",
    "certificate"
  ],

  history: [],

  init() {
    window.addEventListener("popstate", (e) => {
      if (e.state && e.state.node) {
        this.showView(e.state.node, false);
      }
    });
  },

  showView(nodeId, pushToHistory = true) {
    if (!this.nodes.includes(nodeId)) return;

    // Check locking
    const state = window.appState;
    if (nodeId !== "home" && nodeId !== "chapter-map" && !state.unlockedNodes.includes(nodeId)) {
      alert("This activity is locked! Complete the previous activities to unlock this path.");
      return;
    }

    // Hide all view sections
    document.querySelectorAll(".view-section").forEach(view => {
      view.classList.remove("active");
    });

    // Show target view
    const activeView = document.getElementById(nodeId);
    if (activeView) {
      activeView.classList.add("active");
      activeView.classList.add("fade-in");
      setTimeout(() => activeView.classList.remove("fade-in"), 400);
    }

    // Stop speaking old narration
    if (window.VoiceManager) {
      window.VoiceManager.stop();
    }

    // Save node view state
    state.currentNode = nodeId;
    window.StorageManager.saveState(state);

    if (pushToHistory) {
      history.pushState({ node: nodeId }, "", `#${nodeId}`);
    }

    // Trigger page-specific view rendering/init
    if (window.App && window.App.onViewChanged) {
      window.App.onViewChanged(nodeId);
    }

    this.updateNavigationButtons();
  },

  next() {
    const currentIndex = this.nodes.indexOf(window.appState.currentNode);
    if (currentIndex !== -1 && currentIndex < this.nodes.length - 1) {
      const nextNode = this.nodes[currentIndex + 1];
      // Force unlock next node on transition to simulate continuous success
      if (!window.appState.unlockedNodes.includes(nextNode)) {
        window.appState.unlockedNodes.push(nextNode);
      }
      this.showView(nextNode);
    }
  },

  prev() {
    const currentIndex = this.nodes.indexOf(window.appState.currentNode);
    if (currentIndex > 0) {
      const prevNode = this.nodes[currentIndex - 1];
      this.showView(prevNode);
    }
  },

  updateNavigationButtons() {
    const prevBtn = document.getElementById("nav-prev-btn");
    const nextBtn = document.getElementById("nav-next-btn");
    const mapBtn = document.getElementById("nav-map-btn");
    const current = window.appState.currentNode;

    if (prevBtn) prevBtn.disabled = (current === "home");
    if (nextBtn) nextBtn.disabled = (current === "certificate");
    if (mapBtn) mapBtn.style.display = (current === "home" || current === "chapter-map") ? "none" : "block";

    // Update active node styling in Chapter Map view
    document.querySelectorAll(".roadmap-node").forEach(node => {
      const id = node.dataset.node;
      node.className = "roadmap-node";
      if (id === current) {
        node.classList.add("active");
      }
      if (window.appState.completedNodes.includes(id)) {
        node.classList.add("completed");
      }
      if (!window.appState.unlockedNodes.includes(id)) {
        node.classList.add("locked");
      }
    });
  }
};
window.NavigationManager = NavigationManager;
NavigationManager.init();
