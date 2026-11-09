/* shared.js */

const ACTIVITIES = [
  { id: 'activity01', title: 'Activity 2.1: Magnifying Lens', file: 'activity01_magnifying_glass.html' },
  { id: 'activity02', title: 'Activity 2.2: Onion Peel Cell Lab', file: 'activity02_onion_cell.html' },
  { id: 'activity03', title: 'Activity 2.3: Human Cheek Cell Lab', file: 'activity03_cheek_cell.html' },
  { id: 'activity04', title: 'Activity 2.4: Pond Water Observation', file: 'activity04_pond_water.html' },
  { id: 'activity05', title: 'Activity 2.5: Soil Suspension Lab', file: 'activity05_soil_microbes.html' },
  { id: 'activity06', title: 'Activity 2.6: Microbe Sorting Game', file: 'activity06_microbe_identification.html' },
  { id: 'activity07', title: 'Activity 2.7: Compost Simulator', file: 'activity07_compost.html' },
  { id: 'activity08', title: 'Activity 2.8: Yeast Fermentation', file: 'activity08_yeast_experiment.html' },
  { id: 'activity09', title: 'Activity 2.9: Curd Preparation Lab', file: 'activity09_curd_preparation.html' },
  { id: 'activity10', title: 'Plant & Animal Cell Builder', file: 'activity10_cell_builder.html' },
  { id: 'activity11', title: 'Cell Comparison & Sorting', file: 'activity11_cell_comparison.html' },
  { id: 'activity12', title: 'Levels of Organisation', file: 'activity12_levels_organisation.html' },
  { id: 'activity13', title: 'Microscope Explorer & History', file: 'activity13_microscope_explorer.html' },
  { id: 'activity14', title: 'Indian Fermented Foods Game', file: 'activity14_food_fermentation.html' },
  { id: 'activity15', title: 'Scientific Notebook & Quiz', file: 'activity15_final_quiz.html' }
];

// Initialize Progress
function getProgress() {
  const progress = localStorage.getItem('chapter2_progress');
  return progress ? JSON.parse(progress) : {};
}

function saveProgress(activityId, status = true) {
  const progress = getProgress();
  progress[activityId] = status;
  localStorage.setItem('chapter2_progress', JSON.stringify(progress));
  updateProgressUI();
  
  // Show toast notification
  if (status) {
    showToast('Activity completed! progress updated.', 'success');
  }
}

function getCompletedCount() {
  const progress = getProgress();
  return Object.values(progress).filter(Boolean).length;
}

// Inject layouts (Navbar, Sidebar, Footer)
function initApp(currentActivityId) {
  // Set theme from localStorage or default to system preference
  const savedTheme = localStorage.getItem('app_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const body = document.body;
  
  // 1. Create and inject Navbar
  const header = document.createElement('header');
  header.className = 'app-header';
  
  const completed = getCompletedCount();
  const pct = Math.round((completed / ACTIVITIES.length) * 100);

  header.innerHTML = `
    <div class="nav-container">
      <a href="index.html" class="logo-link">
        <svg class="logo-icon" viewBox="0 0 24 24">
          <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.22 19.58 10.57 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>MicroWorld Lab</span>
      </a>
      <span class="chapter-badge">NCERT Class 8 • Chapter 2</span>
      
      <div class="nav-progress-wrapper">
        <div class="progress-info">
          <span>Chapter Completion</span>
          <span id="pct-label">${pct}%</span>
        </div>
        <div class="progress-outer">
          <div class="progress-inner" id="progress-bar" style="width: ${pct}%"></div>
        </div>
      </div>
      
      <div class="nav-controls">
        <button class="theme-toggle" id="theme-btn" aria-label="Toggle Theme">
          ${savedTheme === 'dark' ? '☀️' : '🌙'}
        </button>
        <a href="index.html" class="btn-nav-action">
          🏠 Home
        </a>
      </div>
    </div>
  `;
  
  body.insertBefore(header, body.firstChild);
  
  // Theme Toggle Event
  document.getElementById('theme-btn').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app_theme', newTheme);
    document.getElementById('theme-btn').innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
  });

  // 2. Setup Sidebar inside .meta-panel if it exists
  const metaPanel = document.querySelector('.meta-panel');
  if (metaPanel) {
    const sidebarNav = document.createElement('div');
    sidebarNav.className = 'glass-card';
    
    let linksHtml = '';
    const progress = getProgress();
    
    ACTIVITIES.forEach(act => {
      const activeClass = act.id === currentActivityId ? 'active' : '';
      const completedClass = progress[act.id] ? 'completed' : '';
      linksHtml += `
        <li>
          <a href="${act.file}" class="activity-link-item ${activeClass} ${completedClass}">
            <span>${act.title}</span>
          </a>
        </li>
      `;
    });
    
    sidebarNav.innerHTML = `
      <h3 class="sidebar-nav-title">Activities & Labs</h3>
      <ul class="activity-list">
        ${linksHtml}
      </ul>
    `;
    metaPanel.appendChild(sidebarNav);
  }

  // 3. Inject footer back/next actions inside .action-controls if it exists
  const actionControls = document.querySelector('.action-controls');
  if (actionControls && currentActivityId) {
    const currentIndex = ACTIVITIES.findIndex(act => act.id === currentActivityId);
    const prevAct = currentIndex > 0 ? ACTIVITIES[currentIndex - 1] : null;
    const nextAct = currentIndex < ACTIVITIES.length - 1 ? ACTIVITIES[currentIndex + 1] : null;
    
    const navButtons = document.createElement('div');
    navButtons.className = 'left-actions';
    
    let navButtonsHtml = '';
    if (prevAct) {
      navButtonsHtml += `<a href="${prevAct.file}" class="btn-action">← Previous Activity</a>`;
    } else {
      navButtonsHtml += `<a href="index.html" class="btn-action">← Dashboard</a>`;
    }
    
    if (nextAct) {
      navButtonsHtml += `<a href="${nextAct.file}" class="btn-primary">Next Activity →</a>`;
    } else {
      navButtonsHtml += `<a href="index.html" class="btn-primary">Finish Chapter!</a>`;
    }

    navButtons.innerHTML = navButtonsHtml;
    actionControls.insertBefore(navButtons, actionControls.firstChild);
  }

  // 4. Create Toast container
  const toastContainer = document.createElement('div');
  toastContainer.className = 'alert-popup';
  toastContainer.id = 'toast-container';
  body.appendChild(toastContainer);

  // 5. Append generic Footer
  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `
    <p>© 2026 MicroWorld Lab. Designed as per NCERT Class 8 Science Curriculum. Interactive & Experimental Platform.</p>
  `;
  body.appendChild(footer);
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:none;border:none;cursor:pointer;color:inherit;font-weight:bold;" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Live update of progress bars
function updateProgressUI() {
  const completed = getCompletedCount();
  const pct = Math.round((completed / ACTIVITIES.length) * 100);
  
  const bar = document.getElementById('progress-bar');
  const label = document.getElementById('pct-label');
  if (bar) bar.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}%`;

  // Update sidebar checks if available
  const progress = getProgress();
  ACTIVITIES.forEach(act => {
    const elements = document.querySelectorAll(`a[href="${act.file}"]`);
    elements.forEach(el => {
      if (progress[act.id]) {
        el.classList.add('completed');
      } else {
        el.classList.remove('completed');
      }
    });
  });
}

// Global modal helpers
function setupModal(modalId, triggerBtnId, closeBtnId) {
  const modal = document.getElementById(modalId);
  const trigger = document.getElementById(triggerBtnId);
  const close = document.getElementById(closeBtnId);
  
  if (!modal || !trigger) return;
  
  trigger.addEventListener('click', () => {
    modal.classList.add('active');
  });
  
  const closeFn = () => modal.classList.remove('active');
  if (close) close.addEventListener('click', closeFn);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeFn();
  });
}
