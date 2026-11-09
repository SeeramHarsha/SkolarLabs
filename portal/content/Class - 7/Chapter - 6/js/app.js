/**
 * app.js - Main Application State, Router, Narration system & Settings manager
 */

const AppState = {
    xp: 0,
    coins: 0,
    badges: [],
    progress: 0,
    currentScreen: 'home-screen',
    completedScreens: [],
    theme: 'light',
    narrationEnabled: false,
    narrationSpeed: 1.0,
    narrationPitch: 1.0,
    currentUtterance: null,
    reflectionJournal: "",
    unlockedScreens: ['home-screen', 'intro-screen']
};

const badgeList = {
    'growth_champion': { name: 'Growth Champion', icon: '🌱' },
    'healthy_habits': { name: 'Healthy Habits Hero', icon: '🍎' },
    'nutrition_expert': { name: 'Nutrition Expert', icon: '🧪' },
    'cyber_safety': { name: 'Cyber Safety Hero', icon: '🛡️' },
    'fitness_champion': { name: 'Fitness Champion', icon: '⚡' },
    'science_explorer': { name: 'Science Explorer', icon: '🔬' }
};

// Screen routing map matching navigation steps
const screenOrder = [
    'home-screen',
    'intro-screen',
    'act-6-1-screen',
    'puberty-explorer-screen',
    'menstruation-screen',
    'act-6-2-screen',
    'nutrition-lab-screen',
    'act-6-3-screen',
    'hygiene-screen',
    'fitness-screen',
    'social-safety-screen',
    'act-6-4-screen',
    'substance-abuse-screen',
    'hormone-explorer-screen',
    'science-society-screen',
    'biography-screen',
    'quiz-screen',
    'certificate-screen'
];

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    loadProgress();
    setupEventListeners();
    setupSpeech();
    renderSidebar();
    showScreen(AppState.currentScreen);
    updateDashboardUI();
});

// Load state from local storage
function loadProgress() {
    const saved = localStorage.getItem("ncert_ch6_adolescence_state");
    if (saved) {
        try {
            const data = JSON.parse(saved);
            Object.assign(AppState, data);
            document.documentElement.setAttribute('data-theme', AppState.theme);
        } catch (e) {
            console.error("Error loading save state", e);
        }
    }
}

// Save state to local storage
function saveProgress() {
    localStorage.setItem("ncert_ch6_adolescence_state", JSON.stringify(AppState));
    updateDashboardUI();
}

function updateDashboardUI() {
    document.getElementById("stat-xp").textContent = `${AppState.xp} XP`;
    document.getElementById("stat-coins").textContent = `${AppState.coins} Coins`;
    
    // Update certificate data if on certificate page
    const certXp = document.getElementById("cert-xp");
    const certCoins = document.getElementById("cert-coins");
    if (certXp) certXp.textContent = AppState.xp;
    if (certCoins) certCoins.textContent = AppState.coins;

    // Calculate progress percentage
    const index = screenOrder.indexOf(AppState.currentScreen);
    AppState.progress = Math.round((index / (screenOrder.length - 1)) * 100);
    document.getElementById("progress-fill").style.width = `${AppState.progress}%`;
    document.getElementById("progress-text").textContent = `Chapter Progress: ${AppState.progress}%`;

    // Render badges list in certificates/stats
    const badgeContainer = document.getElementById("stat-badges");
    if (badgeContainer) {
        badgeContainer.innerHTML = AppState.badges.map(b => `
            <span class="badge-icon-item" title="${badgeList[b]?.name || b}">
                ${badgeList[b]?.icon || '🏆'}
            </span>
        `).join("");
    }
}

function awardXP(amount) {
    AppState.xp += amount;
    showToast(`+${amount} XP Earned!`);
    saveProgress();
}

function awardCoins(amount) {
    AppState.coins += amount;
    showToast(`+${amount} Coins Earned!`);
    saveProgress();
}

function awardBadge(badgeId) {
    if (!AppState.badges.includes(badgeId)) {
        AppState.badges.push(badgeId);
        showToast(`🏆 Unlocked Badge: ${badgeList[badgeId]?.name || badgeId}!`);
        saveProgress();
    }
}

function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.background = "var(--accent)";
    toast.style.color = "white";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = "2000";
    toast.style.boxShadow = "var(--card-shadow)";
    toast.style.animation = "fadeIn 0.3s ease";
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Router logic
function showScreen(screenId) {
    if (!screenOrder.includes(screenId)) return;
    
    // Check lock state
    if (!AppState.unlockedScreens.includes(screenId)) {
        AppState.unlockedScreens.push(screenId);
    }
    
    // Stop speaking
    stopSpeaking();

    // Toggle viewport panels
    document.querySelectorAll(".view-panel").forEach(panel => {
        panel.classList.remove("active");
    });
    
    const targetPanel = document.getElementById(screenId);
    if (targetPanel) {
        targetPanel.classList.add("active");
        AppState.currentScreen = screenId;
        saveProgress();
        renderSidebar();
        
        // Auto narrate text summary on view entry
        const textSummary = targetPanel.querySelector(".speech-narration-target")?.textContent || "";
        if (AppState.narrationEnabled && textSummary) {
            speakText(textSummary);
        }
    }
}

function renderSidebar() {
    const mapList = document.getElementById("sidebar-map");
    if (!mapList) return;
    mapList.innerHTML = screenOrder.map((screen, idx) => {
        const readable = screen.replace("-screen", "").replace("act-", "Activity ").replace("-", " ").toUpperCase();
        const isLocked = !AppState.unlockedScreens.includes(screen);
        const isActive = AppState.currentScreen === screen;
        
        return `
            <li class="map-item ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}" 
                onclick="${isLocked ? '' : `showScreen('${screen}')`}">
                <span>${idx + 1}. ${readable}</span>
                ${isLocked ? '<span>🔒</span>' : ''}
            </li>
        `;
    }).join("");
}

function nextScreen() {
    const idx = screenOrder.indexOf(AppState.currentScreen);
    if (idx < screenOrder.length - 1) {
        const next = screenOrder[idx + 1];
        showScreen(next);
    }
}

function prevScreen() {
    const idx = screenOrder.indexOf(AppState.currentScreen);
    if (idx > 0) {
        const prev = screenOrder[idx - 1];
        showScreen(prev);
    }
}

// Web Speech API
function setupSpeech() {
    const voiceBtn = document.getElementById("btn-voice-toggle");
    if (voiceBtn) {
        voiceBtn.addEventListener("click", () => {
            AppState.narrationEnabled = !AppState.narrationEnabled;
            voiceBtn.style.color = AppState.narrationEnabled ? "var(--success)" : "var(--text-primary)";
            voiceBtn.textContent = AppState.narrationEnabled ? "🔊" : "🔇";
            if (AppState.narrationEnabled) {
                const targetText = document.getElementById(AppState.currentScreen)?.querySelector(".speech-narration-target")?.textContent;
                if (targetText) speakText(targetText);
            } else {
                stopSpeaking();
            }
        });
    }
}

function speakText(text) {
    if (!window.speechSynthesis) return;
    stopSpeaking();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = AppState.narrationSpeed;
    utterance.pitch = AppState.narrationPitch;
    AppState.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

function setupEventListeners() {
    const themeBtn = document.getElementById("btn-theme-toggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', AppState.theme);
            saveProgress();
        });
    }

    const toggleBtn = document.getElementById("btn-sidebar-toggle");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const sidebar = document.getElementById("sidebar");
            if (sidebar) sidebar.classList.toggle("open");
        });
    }
}
