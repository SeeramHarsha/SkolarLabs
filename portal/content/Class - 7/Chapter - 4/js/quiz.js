/* Quiz, flowcharts, debate matches, sorting logic */
const QuizManager = {
  currentQuestionIndex: 0,
  score: 0,

  questions: [
    {
      id: 1,
      type: "mcq",
      text: "Which metal is commonly used to make food packaging materials as it is cheaper, and its thin sheets can be folded easily into any shape?",
      options: ["Aluminium", "Copper", "Iron", "Gold"],
      correct: "Aluminium"
    },
    {
      id: 2,
      type: "mcq",
      text: "Which of the following metal catches fire when it comes in contact with water?",
      options: ["Copper", "Aluminium", "Zinc", "Sodium"],
      correct: "Sodium"
    },
    {
      id: 3,
      type: "true_false",
      text: "Aluminium and copper are examples of non-metals used for making utensils and statues.",
      correct: false
    },
    {
      id: 4,
      type: "true_false",
      text: "Metals form oxides when combined with oxygen, the solution of which turns blue litmus paper to red.",
      correct: false
    },
    {
      id: 5,
      type: "true_false",
      text: "Oxygen is a non-metal essential for respiration.",
      correct: true
    },
    {
      id: 6,
      type: "true_false",
      text: "Copper vessels are used for boiling water because they are good conductors of electricity.",
      correct: false
    }
  ],

  // Columns Matching state
  matchingConnections: {},
  matchItemsLeft: [
    { id: "left_1", text: "Used in electrical wiring" },
    { id: "left_2", text: "Most malleable and ductile" },
    { id: "left_3", text: "Living organisms cannot survive without it" },
    { id: "left_4", text: "Plants grow healthy when fertilisers containing it are added" },
    { id: "left_5", text: "Used in water purification" }
  ],
  matchItemsRight: [
    { id: "right_a", text: "E N X Y G O (OXYGEN)", solution: "left_3" },
    { id: "right_b", text: "N E C O H I R L (CHLORINE)", solution: "left_5" },
    { id: "right_c", text: "P E P O R C (COPPER)", solution: "left_1" },
    { id: "right_d", text: "T E N G O I N R (NITROGEN)", solution: "left_4" },
    { id: "right_e", text: "O G D L (GOLD)", solution: "left_2" }
  ],

  // Flowchart slots
  flowchartSlots: {
    slot1: null, // "Magnesium" or "Metal"
    slot2: null, // "Magnesium Oxide" or "Metal Oxide"
    slot3: null  // "Red turns Blue" or "Basic"
  },

  init() {
    this.renderQuestion();
    this.renderMatching();
    this.renderFlowchart();
  },

  renderQuestion() {
    const container = document.getElementById("quiz-q-container");
    if (!container) return;

    if (this.currentQuestionIndex >= this.questions.length) {
      container.innerHTML = `<h3>Quiz Complete! Your Score: ${this.score}/${this.questions.length}</h3>`;
      // Award certificate validation update
      window.appState.completedNodes.push("quiz");
      window.appState.xp += 100;
      window.appState.coins += 50;
      window.App.updateHeaderStats();
      window.StorageManager.saveState(window.appState);
      return;
    }

    const q = this.questions[this.currentQuestionIndex];
    let html = `<p class="quiz-q-text"><strong>Q${this.currentQuestionIndex + 1}:</strong> ${q.text}</p>`;

    if (q.type === "mcq") {
      html += `<div class="quiz-options">`;
      q.options.forEach(opt => {
        html += `<button class="btn-menu quiz-opt-btn" data-answer="${opt}" onclick="QuizManager.answerQuestion('${opt}', this)">${opt}</button>`;
      });
      html += `</div>`;
    } else if (q.type === "true_false") {
      html += `<div class="quiz-options">
        <button class="btn-menu quiz-opt-btn" data-answer="true" onclick="QuizManager.answerQuestion(true, this)">True</button>
        <button class="btn-menu quiz-opt-btn" data-answer="false" onclick="QuizManager.answerQuestion(false, this)">False</button>
      </div>`;
    }

    html += `<p id="quiz-feedback" style="margin-top:12px; font-weight:700;"></p>`;

    container.innerHTML = html;
  },

  answerQuestion(answer, btnEl) {
    const q = this.questions[this.currentQuestionIndex];
    const isCorrect = answer === q.correct;
    const feedback = document.getElementById("quiz-feedback");
    const allBtns = document.querySelectorAll(".quiz-opt-btn");

    allBtns.forEach(b => {
      b.disabled = true;
      const btnAnswer = q.type === "true_false" ? (b.dataset.answer === "true") : b.dataset.answer;
      if (btnAnswer === q.correct) {
        b.classList.add("correct");
      } else if (b === btnEl) {
        b.classList.add("wrong");
      }
    });

    if (isCorrect) {
      this.score++;
      SimulationManager.playSynthSound(600, "sine", 0.15);
      if (feedback) {
        feedback.textContent = "✅ Correct!";
        feedback.style.color = "var(--accent-green)";
      }
    } else {
      SimulationManager.playSynthSound(150, "triangle", 0.3);
      if (feedback) {
        feedback.textContent = `❌ Incorrect. The correct answer is: ${q.correct}`;
        feedback.style.color = "var(--accent-red)";
      }
    }

    setTimeout(() => {
      this.currentQuestionIndex++;
      this.renderQuestion();
    }, 1800);
  },

  resetQuiz() {
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.renderQuestion();
  },

  renderMatching() {
    const leftCol = document.getElementById("match-left");
    const rightCol = document.getElementById("match-right");
    if (!leftCol || !rightCol) return;

    leftCol.innerHTML = this.matchItemsLeft.map(item => `
      <div class="match-card" draggable="true" ondragstart="QuizManager.dragMatch(event)" id="${item.id}">
        ${item.text}
      </div>
    `).join("");

    rightCol.innerHTML = this.matchItemsRight.map(item => `
      <div class="match-card dropzone" ondragover="event.preventDefault()" ondrop="QuizManager.dropMatch(event)" id="${item.id}">
        ${item.text}
        <span class="match-connection-label" id="connected-${item.id}"></span>
      </div>
    `).join("");
  },

  dragMatch(e) {
    e.dataTransfer.setData("text", e.target.id);
  },

  dropMatch(e) {
    e.preventDefault();
    const leftId = e.dataTransfer.getData("text");
    const rightId = e.currentTarget.id;

    // Connect
    this.matchingConnections[rightId] = leftId;

    const label = document.getElementById(`connected-${rightId}`);
    const sourceEl = document.getElementById(leftId);
    if (label && sourceEl) {
      label.innerText = ` 🔗 (Connected)`;
      label.style.color = "var(--accent-blue)";
    }

    this.checkMatchingResult();
  },

  checkMatchingResult() {
    const keys = Object.keys(this.matchingConnections);
    if (keys.length === 5) {
      let allCorrect = true;
      this.matchItemsRight.forEach(item => {
        if (this.matchingConnections[item.id] !== item.solution) {
          allCorrect = false;
        }
      });

      const resultLabel = document.getElementById("match-result-label");
      if (allCorrect) {
        if (resultLabel) {
          resultLabel.innerText = "All Matches Correct! +50 XP";
          resultLabel.style.color = "var(--accent-green)";
        }
        window.appState.xp += 50;
        window.App.updateHeaderStats();
        window.StorageManager.saveState(window.appState);
      } else {
        if (resultLabel) {
          resultLabel.innerText = "Some matches are incorrect. Try again!";
          resultLabel.style.color = "var(--accent-red)";
        }
      }
    }
  },

  resetMatching() {
    this.matchingConnections = {};
    const resultLabel = document.getElementById("match-result-label");
    if (resultLabel) resultLabel.innerText = "";
    this.renderMatching();
  },

  renderFlowchart() {
    const container = document.getElementById("flowchart-container");
    if (!container) return;

    // Display flowchart and inputs
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px; align-items:center;">
        <div class="stat-item">[ ? ] Metal Ribbon</div>
        <div>⬇ + Air + Heat</div>
        <div class="stat-item">[ ? ] Oxide Powder</div>
        <div>⬇ + Water</div>
        <div class="stat-item">[ ? ] Solution Nature</div>
      </div>
      <div style="margin-top:20px; display:flex; gap:10px;">
        <select id="flow-s1" class="select-obs">
          <option value="">Select Ribbon</option>
          <option value="iron">Iron</option>
          <option value="magnesium">Magnesium</option>
        </select>
        <select id="flow-s2" class="select-obs">
          <option value="">Select Oxide</option>
          <option value="magnesium_oxide">Magnesium Oxide</option>
          <option value="sulfur_dioxide">Sulfur Dioxide</option>
        </select>
        <select id="flow-s3" class="select-obs">
          <option value="">Select Nature</option>
          <option value="acidic">Acidic (turns blue to red)</option>
          <option value="basic">Basic (turns red to blue)</option>
        </select>
      </div>
      <button class="btn-menu" style="margin-top:15px;" onclick="QuizManager.checkFlowchart()">Verify Flowchart</button>
      <p id="flow-result" style="margin-top:10px; font-weight:700;"></p>
    `;
  },

  checkFlowchart() {
    const s1 = document.getElementById("flow-s1").value;
    const s2 = document.getElementById("flow-s2").value;
    const s3 = document.getElementById("flow-s3").value;
    const res = document.getElementById("flow-result");

    if (s1 === "magnesium" && s2 === "magnesium_oxide" && s3 === "basic") {
      res.innerText = "Flowchart Completed Correctly! +30 XP";
      res.style.color = "var(--accent-green)";
      window.appState.xp += 30;
      window.App.updateHeaderStats();
      window.StorageManager.saveState(window.appState);
    } else {
      res.innerText = "Incorrect connections. Hint: Think of Activity 4.6 (Magnesium ribbon).";
      res.style.color = "var(--accent-red)";
    }
  }
};
window.QuizManager = QuizManager;
