document.addEventListener('DOMContentLoaded', () => {
  initState();
  initTheme();
  injectUI();
});

// Global state
let gameState = {
  completions: {}
};
// Initialize State from LocalStorage
function initState() {
  const savedState = localStorage.getItem('exploring_forces_state');
  if (savedState) {
    try {
      gameState = JSON.parse(savedState);
    } catch (e) {
      console.error("Failed to parse state", e);
    }
  } else {
    saveState();
  }
  window.gameState = gameState;
}

function saveState() {
  localStorage.setItem('exploring_forces_state', JSON.stringify(gameState));
}

// Theme handling
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  const icon = document.querySelector('.theme-toggle-btn i');
  if (icon) {
    icon.className = newTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }
}

// Complete Activity
function completeActivity(activityId) {
  if (!gameState.completions[activityId]) {
    gameState.completions[activityId] = true;
    saveState();
  }
}

// Automatically Inject Shared UI components
function injectUI() {
  const headerPlaceholder = document.getElementById('app-header-placeholder');
  const footerPlaceholder = document.getElementById('app-footer-placeholder');
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const themeIconClass = currentTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  
  if (headerPlaceholder) {
    headerPlaceholder.innerHTML = `
      <header class="app-header">
        <a href="index.html" class="header-logo">
          <i class="fa-solid fa-flask"></i> Exploring Forces Labs
        </a>
        <div class="header-stats">
          <button class="theme-toggle-btn" onclick="toggleTheme()" aria-label="Toggle Theme">
            <i class="${themeIconClass}"></i>
          </button>
          <a href="index.html" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;">
            <i class="fa-solid fa-house"></i> Hub
          </a>
        </div>
      </header>
    `;
  }
  
  if (footerPlaceholder) {
    footerPlaceholder.innerHTML = `
      <footer style="margin-top: 80px; padding: 30px; text-align: center; border-top: 1px solid var(--card-border); color: var(--text-muted); font-size: 0.9rem;">
        <p>© Curiosity Classroom: NCERT Grade 8 Science Chapter 5 - Exploring Forces</p>
        <p style="margin-top: 5px; font-size: 0.8rem; opacity: 0.7;">Designed with Premium Animations & Physics-based Interactions</p>
      </footer>
    `;
  }
}

// Global functions exposed to window
window.toggleTheme = toggleTheme;
window.completeActivity = completeActivity;
window.gameState = gameState;
