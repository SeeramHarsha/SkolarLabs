/* shared.js */

const ACTIVITIES = [
  { id: 'activity01', title: 'Activity 3.1: Health Story', file: 'activity01_health_story.html', xp: 100, difficulty: 'Easy' },
  { id: 'activity02', title: 'Activity 3.2: Healthy Habits Builder', file: 'activity02_healthy_habits.html', xp: 100, difficulty: 'Easy' },
  { id: 'activity03', title: 'Activity 3.3: Playground Investigator', file: 'activity03_playground.html', xp: 150, difficulty: 'Medium' },
  { id: 'activity04', title: 'Activity 3.4: Disease Investigation Lab', file: 'activity04_disease_lab.html', xp: 150, difficulty: 'Medium' },
  { id: 'activity05', title: 'Activity 3.5: Lifestyle Survey', file: 'activity05_lifestyle_survey.html', xp: 200, difficulty: 'Hard' },
  { id: 'activity06', title: 'Activity 3.6: Health Campaign', file: 'activity06_health_campaign.html', xp: 200, difficulty: 'Hard' },
  { id: 'activity07', title: 'Activity 3.7: Antibiotic Resistance Lab', file: 'activity07_antibiotic_resistance.html', xp: 250, difficulty: 'Hard' },
  { id: 'activity08', title: 'Vaccination Camp Simulation', file: 'activity08_vaccination_camp.html', xp: 150, difficulty: 'Medium' },
  { id: 'activity09', title: 'Immune System Battle', file: 'activity09_disease_explorer.html', xp: 200, difficulty: 'Medium' },
  { id: 'activity10', title: 'Interactive Health Trackers', file: 'activity10_health_dashboard.html', xp: 100, difficulty: 'Easy' },
  { id: 'quiz_final', title: 'Final Assessment & Certificate', file: 'quiz_final.html', xp: 300, difficulty: 'Hard' }
];

// Initialize Game State
function getGameState() {
  const defaultState = {
    progress: {},
    xp: 0,
    coins: 0,
    streak: 1,
    lastActiveDate: null,
    badges: [],
    quizScore: 0,
    weakTopics: []
  };
  const saved = localStorage.getItem('chapter3_gamestate');
  return saved ? JSON.parse(saved) : defaultState;
}

function saveGameState(state) {
  localStorage.setItem('chapter3_gamestate', JSON.stringify(state));
  updateNavUI();
}

function completeActivity(activityId, extraCoins = 20) {
  const state = getGameState();
  if (!state.progress[activityId]) {
    state.progress[activityId] = true;
    const act = ACTIVITIES.find(a => a.id === activityId);
    if (act) {
      state.xp += act.xp;
      state.coins += extraCoins;
      showToast(`🎉 Completed! +${act.xp} XP & +${extraCoins} Coins!`, 'success');
      
      // Streak Handler
      const today = new Date().toDateString();
      if (state.lastActiveDate && state.lastActiveDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (state.lastActiveDate === yesterday) {
          state.streak += 1;
        } else {
          state.streak = 1;
        }
      }
      state.lastActiveDate = today;

      // Badge check
      checkAndUnlockBadges(state, activityId);
      saveGameState(state);
    }
  }
}

function checkAndUnlockBadges(state, newlyCompletedId) {
  const completedCount = Object.keys(state.progress).filter(k => state.progress[k]).length;
  
  if (completedCount >= 1 && !state.badges.includes('wellness_rookie')) {
    state.badges.push('wellness_rookie');
    showBadgeUnlockToast('Wellness Rookie', 'Completed your first interactive lab!');
  }
  if (newlyCompletedId === 'activity03' && !state.badges.includes('sanitation_hero')) {
    state.badges.push('sanitation_hero');
    showBadgeUnlockToast('Sanitation Hero', 'Spotting standing water and pollution risks.');
  }
  if (newlyCompletedId === 'activity06' && !state.badges.includes('super_officer')) {
    state.badges.push('super_officer');
    showBadgeUnlockToast('Super Officer', 'Managed community health budget effectively!');
  }
  if (newlyCompletedId === 'activity07' && !state.badges.includes('antibiotic_defender')) {
    state.badges.push('antibiotic_defender');
    showBadgeUnlockToast('Antibiotic Defender', 'Prevented bacterial resistance mutation.');
  }
  if (newlyCompletedId === 'activity09' && !state.badges.includes('immune_knight')) {
    state.badges.push('immune_knight');
    showBadgeUnlockToast('Immune Knight', 'Helped White Blood Cells crush the pathogen invasion!');
  }
  if (completedCount >= 10 && !state.badges.includes('grand_scholar')) {
    state.badges.push('grand_scholar');
    showBadgeUnlockToast('Grand Health Scholar', 'All activities in Health Chapter completed!');
  }
}

function showBadgeUnlockToast(badgeName, desc) {
  setTimeout(() => {
    showToast(`🏆 BADGE UNLOCKED: "${badgeName}" - ${desc}`, 'warning');
  }, 1500);
}

function initApp(currentActivityId) {
  const savedTheme = localStorage.getItem('app_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const state = getGameState();
  const body = document.body;

  // 1. Create and inject Header
  const header = document.createElement('header');
  header.className = 'app-header';
  
  const completed = Object.keys(state.progress).filter(k => state.progress[k]).length;
  const pct = Math.round((completed / ACTIVITIES.length) * 100);

  header.innerHTML = `
    <div class="nav-container">
      <a href="index.html" class="logo-link">
        <svg class="logo-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>Vitality Academy</span>
      </a>
      <span class="chapter-badge">Chapter 3: Health & Wellness</span>
      
      <div class="nav-progress-wrapper">
        <div class="progress-info">
          <span>Overall Progress</span>
          <span id="pct-label">${pct}%</span>
        </div>
        <div class="progress-outer">
          <div class="progress-inner" id="progress-bar" style="width: ${pct}%"></div>
        </div>
      </div>

      <div class="nav-stats">
        <div class="nav-stat-item" title="XP Points">✨ <span id="xp-display">${state.xp}</span> XP</div>
        <div class="nav-stat-item" title="Health Coins">🪙 <span id="coins-display">${state.coins}</span></div>
        <div class="nav-stat-item" title="Daily Streak">🔥 <span>${state.streak}</span></div>
      </div>
      
      <div class="nav-controls">
        <button class="theme-toggle" id="theme-btn" aria-label="Toggle Theme">
          ${savedTheme === 'dark' ? '☀️' : '🌙'}
        </button>
        <a href="index.html" class="btn-nav-action">🏠 Home</a>
      </div>
    </div>
  `;
  body.insertBefore(header, body.firstChild);

  // Theme Toggle Event Listener
  document.getElementById('theme-btn').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app_theme', newTheme);
    document.getElementById('theme-btn').innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
  });

  // 2. Setup Sidebar Inside .meta-panel if it exists
  const metaPanel = document.querySelector('.meta-panel');
  if (metaPanel) {
    const sidebarNav = document.createElement('div');
    sidebarNav.className = 'glass-card';
    
    let linksHtml = '';
    ACTIVITIES.forEach(act => {
      const activeClass = act.id === currentActivityId ? 'active' : '';
      const completedClass = state.progress[act.id] ? 'completed' : '';
      linksHtml += `
        <li>
          <a href="${act.file}" class="activity-link-item ${activeClass} ${completedClass}">
            <span>${act.title}</span>
          </a>
        </li>
      `;
    });
    
    sidebarNav.innerHTML = `
      <h3 class="sidebar-nav-title">Interactive Chapters</h3>
      <ul class="activity-list">
        ${linksHtml}
      </ul>
    `;
    metaPanel.appendChild(sidebarNav);
  }

  // 3. Inject Navigation controls inside .action-controls if it exists
  const actionControls = document.querySelector('.action-controls');
  if (actionControls && currentActivityId) {
    const currentIndex = ACTIVITIES.findIndex(act => act.id === currentActivityId);
    const prevAct = currentIndex > 0 ? ACTIVITIES[currentIndex - 1] : null;
    const nextAct = currentIndex < ACTIVITIES.length - 1 ? ACTIVITIES[currentIndex + 1] : null;
    
    const leftActions = document.createElement('div');
    leftActions.className = 'left-actions';
    if (prevAct) {
      leftActions.innerHTML = `<a href="${prevAct.file}" class="btn-action">← Previous Module</a>`;
    } else {
      leftActions.innerHTML = `<a href="index.html" class="btn-action">← Dashboard</a>`;
    }

    const rightActions = document.createElement('div');
    rightActions.className = 'right-actions';
    if (nextAct) {
      rightActions.innerHTML = `
        <button id="show-hint-btn" class="btn-action" style="margin-right: 0.5rem;">💡 Get Hint</button>
        <a href="${nextAct.file}" class="btn-primary">Next Module →</a>
      `;
    } else {
      rightActions.innerHTML = `
        <button id="show-hint-btn" class="btn-action" style="margin-right: 0.5rem;">💡 Get Hint</button>
        <a href="index.html" class="btn-primary">Finish Chapter!</a>
      `;
    }
    
    actionControls.appendChild(leftActions);
    actionControls.appendChild(rightActions);
  }

  // 4. Create Toast container
  const toastContainer = document.createElement('div');
  toastContainer.className = 'alert-popup';
  toastContainer.id = 'toast-container';
  body.appendChild(toastContainer);

  // 5. Append Footer
  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `
    <p>© 2026 Vitality Academy. Alignment with NCERT Grade 8 Science. Designed for interactive learning.</p>
  `;
  body.appendChild(footer);
}

// Update Nav HUD Numbers
function updateNavUI() {
  const state = getGameState();
  const xpDisp = document.getElementById('xp-display');
  const coinsDisp = document.getElementById('coins-display');
  const pctLbl = document.getElementById('pct-label');
  const bar = document.getElementById('progress-bar');
  
  if (xpDisp) xpDisp.textContent = state.xp;
  if (coinsDisp) coinsDisp.textContent = state.coins;

  const completed = Object.keys(state.progress).filter(k => state.progress[k]).length;
  const pct = Math.round((completed / ACTIVITIES.length) * 100);
  if (pctLbl) pctLbl.textContent = `${pct}%`;
  if (bar) bar.style.width = `${pct}%`;
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:none;border:none;cursor:pointer;color:inherit;font-weight:bold;font-size:1.15rem;" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}
