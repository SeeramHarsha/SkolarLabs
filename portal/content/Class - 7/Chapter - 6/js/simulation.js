/**
 * simulation.js - Complete interactive lab engines for Chapter 6 activities
 */

// Home page interactive height tracker & tree growth
function updateHomeTreeHeight(heightVal) {
    const scaleFactor = (heightVal - 100) / 100; // range 100 to 200 cm
    
    // Scale the avatar
    const avatar = document.getElementById("home-avatar-svg");
    if (avatar) {
        avatar.style.transform = `scale(${1 + scaleFactor * 0.5})`;
    }
    
    // Scale/animate height text
    const label = document.getElementById("height-scale-label");
    if (label) {
        label.textContent = `${heightVal} cm`;
    }

    // Grow the background tree
    const tree = document.getElementById("home-tree-path");
    if (tree) {
        // SVG scale manipulation
        tree.setAttribute("transform", `scale(${0.4 + scaleFactor * 0.8})`);
    }
}

// Activity 6.1: Drag cards into jar/table
function initActivity6_1() {
    const cards = document.querySelectorAll(".drag-card");
    const container = document.getElementById("act-6-1-drop-target");
    if (!container) return;

    cards.forEach(card => {
        card.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", card.id);
        });
    });

    container.addEventListener("dragover", (e) => {
        e.preventDefault();
    });

    container.addEventListener("drop", (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        const el = document.getElementById(id);
        if (el) {
            container.appendChild(el);
            // Fill observation rows
            const obsType = el.dataset.observation;
            const targetCell = document.querySelector(`.obs-row[data-obs-type="${obsType}"] .obs-value`);
            if (targetCell) {
                targetCell.textContent = el.dataset.obsVal;
                targetCell.style.color = "var(--success)";
                awardXP(10);
            }
        }
    });
}

// Puberty Explorer Interactive hotspots
function selectExplorerPart(part, details) {
    const box = document.getElementById("puberty-details-card");
    if (box) {
        box.innerHTML = `
            <h3>${part.replace("-", " ").toUpperCase()}</h3>
            <p>${details}</p>
        `;
        box.style.display = "block";
        speakText(`${part}. ${details}`);
        awardXP(15);
    }
}

// Menstruation Cycle Simulator Clock
let currentCycleDay = 1;
function rotateCycleDay(delta) {
    currentCycleDay = (currentCycleDay + delta - 1 + 28) % 28 + 1;
    const pointer = document.getElementById("cycle-pointer");
    const label = document.getElementById("cycle-day-label");
    const desc = document.getElementById("cycle-phase-desc");
    
    if (pointer) {
        pointer.style.transform = `rotate(${(currentCycleDay / 28) * 360}deg)`;
    }
    if (label) {
        label.textContent = `Day ${currentCycleDay}`;
    }

    let phase = "";
    if (currentCycleDay <= 5) {
        phase = "Menstruation (Blood discharge occurs, 3-7 days, normal biological phase).";
    } else if (currentCycleDay <= 14) {
        phase = "Follicular/Ovulation phase (Preparation of egg, release at Day 14).";
    } else {
        phase = "Luteal phase (Cycle restarts if fertilisation doesn't occur).";
    }
    
    if (desc) {
        desc.textContent = phase;
    }
}

// Activity 6.2 reflection journal
function saveJournalReflection() {
    const txt = document.getElementById("reflection-journal-textarea")?.value;
    if (txt) {
        AppState.reflectionJournal = txt;
        awardCoins(20);
        awardBadge("growth_champion");
        showToast("Journal entry saved successfully!");
    }
}

// Food Lab and Nutrition Meter calculations
let selectedFoods = [];
const nutritionValues = {
    'milk': { protein: 25, iron: 5, calcium: 40, b12: 30, energy: 20 },
    'curd': { protein: 20, iron: 2, calcium: 35, b12: 25, energy: 15 },
    'millets': { protein: 15, iron: 25, calcium: 15, b12: 5, energy: 35 },
    'eggs': { protein: 35, iron: 15, calcium: 10, b12: 45, energy: 25 },
    'dal': { protein: 30, iron: 20, calcium: 12, b12: 5, energy: 20 },
    'beans': { protein: 22, iron: 25, calcium: 15, b12: 2, energy: 25 },
    'spinach': { protein: 10, iron: 50, calcium: 20, b12: 2, energy: 10 },
    'fruits': { protein: 5, iron: 10, calcium: 8, b12: 2, energy: 30 },
    'vegetables': { protein: 8, iron: 15, calcium: 10, b12: 2, energy: 15 }
};

function toggleFoodSelection(foodName) {
    const idx = selectedFoods.indexOf(foodName);
    const card = document.querySelector(`.food-item-card[data-food="${foodName}"]`);
    
    if (idx > -1) {
        selectedFoods.splice(idx, 1);
        card?.classList.remove("selected");
    } else {
        selectedFoods.push(foodName);
        card?.classList.add("selected");
    }
    
    updateNutritionMeter();
}

function updateNutritionMeter() {
    let totals = { protein: 0, iron: 0, calcium: 0, b12: 0, energy: 0 };
    selectedFoods.forEach(food => {
        const stats = nutritionValues[food];
        if (stats) {
            totals.protein += stats.protein;
            totals.iron += stats.iron;
            totals.calcium += stats.calcium;
            totals.b12 += stats.b12;
            totals.energy += stats.energy;
        }
    });

    // Cap totals at 100%
    for (let key in totals) {
        totals[key] = Math.min(totals[key], 100);
        const fillBar = document.getElementById(`nutri-fill-${key}`);
        const textVal = document.getElementById(`nutri-val-${key}`);
        if (fillBar) fillBar.style.width = `${totals[key]}%`;
        if (textVal) textVal.textContent = `${totals[key]}%`;
    }
}

// Activity 6.3 Nutrients Sorting Lab
function checkNutritionSortingTable() {
    const slots = document.querySelectorAll(".nutrition-slot");
    let correctCount = 0;
    
    slots.forEach(slot => {
        const matchedType = slot.getAttribute("data-nutrient");
        const draggedItem = slot.querySelector(".drag-item");
        if (draggedItem && draggedItem.getAttribute("data-nutrient-type") === matchedType) {
            correctCount++;
            slot.style.borderColor = "var(--success)";
        } else {
            slot.style.borderColor = "var(--danger)";
        }
    });

    if (correctCount === slots.length) {
        awardCoins(30);
        awardBadge("nutrition_expert");
        showToast("All Nutrient connections are Correct!");
    } else {
        showToast(`Matched ${correctCount}/${slots.length} correctly. Try again!`);
    }
}

function resetNutritionTable() {
    const sourceArea = document.getElementById("quiz-draggable-source-area-2");
    const slotLabels = {
        "slot-cal": "Drop Bone Nutrient Here",
        "slot-iron": "Drop Blood Nutrient Here"
    };

    document.querySelectorAll(".nutrition-slot").forEach(slot => {
        const draggedItem = slot.querySelector(".drag-item");
        if (draggedItem && sourceArea) {
            sourceArea.appendChild(draggedItem);
        }
        slot.style.borderColor = "";
        slot.textContent = slotLabels[slot.id] || "Drop Here";
    });
}

// Fitness Studio game loop
let workoutEnergy = 50;
function performWorkout(type, energyCost) {
    workoutEnergy = Math.min(100, workoutEnergy + energyCost);
    const fillBar = document.getElementById("fitness-energy-fill");
    const countDisplay = document.getElementById("fitness-status-txt");
    
    if (fillBar) fillBar.style.width = `${workoutEnergy}%`;
    if (countDisplay) countDisplay.textContent = `Energy & Mood Stamina: ${workoutEnergy}%`;
    
    speakText(`Performed ${type}. Good job!`);
    awardXP(5);
    
    if (workoutEnergy >= 100) {
        awardBadge("fitness_champion");
        awardCoins(20);
    }
}

// Substance Abuse Choice before/after lung simulation
function toggleSubstanceChoice(choice) {
    const beforeLungs = document.getElementById("lungs-before");
    const afterLungs = document.getElementById("lungs-after");
    
    if (choice === 'no') {
        beforeLungs.style.opacity = '1';
        afterLungs.style.opacity = '0.3';
        awardXP(25);
        awardCoins(15);
        showToast("Excellent choice! Saying NO keeps your body healthy.");
    } else {
        beforeLungs.style.opacity = '0.3';
        afterLungs.style.opacity = '1';
        showToast("Peer pressure avoided! Smoking blocks lungs with tar.");
    }
}

// Endocrine hormone traveling particle effect
function triggerHormoneTravel() {
    const parent = document.getElementById("hormone-travel-area");
    if (!parent) return;
    
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement("div");
        particle.className = "hormone-particle";
        // randomize flow offset path
        particle.style.setProperty('--flow-x', `${120 + Math.random() * 80}px`);
        particle.style.setProperty('--flow-y', `${Math.random() * 40 - 20}px`);
        particle.style.left = "80px";
        particle.style.top = "100px";
        parent.appendChild(particle);
        setTimeout(() => particle.remove(), 2500);
    }
}
