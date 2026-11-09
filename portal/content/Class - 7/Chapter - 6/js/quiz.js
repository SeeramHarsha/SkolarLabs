/**
 * quiz.js - Interactive assessment modules containing Q1-Q10 textbook questions
 * converts every textbook question into interactive elements
 */

const QuizEngine = {
    currentAnswers: {},

    // Unscramble questions (Q3)
    checkUnscramble(id, inputId, correctAnswer) {
        const inputEl = document.getElementById(inputId);
        const feedback = document.getElementById(`${inputId}-feedback`);
        if (!inputEl || !feedback) return;
        
        const userVal = inputEl.value.trim().toLowerCase();
        if (userVal === correctAnswer.toLowerCase()) {
            feedback.textContent = "Correct!";
            feedback.style.color = "var(--success)";
            awardXP(10);
        } else {
            feedback.textContent = `Try again! Hint: Starts with ${correctAnswer[0]}`;
            feedback.style.color = "var(--danger)";
        }
    },

    // Categorization question (Q9)
    checkPhysicalCategorisation() {
        const slots = document.querySelectorAll(".cate-slot");
        let score = 0;
        slots.forEach(slot => {
            const expect = slot.getAttribute("data-category");
            const dragged = slot.querySelector(".drag-item");
            if (dragged) {
                const actual = dragged.getAttribute("data-category");
                if (expect === actual) {
                    score++;
                    slot.style.borderColor = "var(--success)";
                } else {
                    slot.style.borderColor = "var(--danger)";
                }
            }
        });

        if (score >= 6) {
            awardCoins(25);
            awardBadge("science_explorer");
            showToast("Categorisation Completed Successfully!");
        } else {
            showToast(`Correct categorised: ${score}/7. Drag correctly and check again.`);
        }
    },

    // MCQ Questions feedback
    checkMultipleChoice(questionId, selectedOption, correctOption) {
        const feedbackEl = document.getElementById(`mcq-feedback-${questionId}`);
        if (!feedbackEl) return;

        if (selectedOption === correctOption) {
            feedbackEl.textContent = "Correct! Great work.";
            feedbackEl.className = "quiz-feedback correct";
            awardXP(15);
        } else {
            feedbackEl.textContent = "Incorrect. Try selecting another option.";
            feedbackEl.className = "quiz-feedback wrong";
        }
    }
};

// Handle generic drag events for quiz drag & drop sorting
function allowQuizDrag(ev) {
    ev.preventDefault();
}

function handleQuizDrag(ev) {
    ev.dataTransfer.setData("text/plain", ev.target.id);
}

function handleQuizDrop(ev, targetSlotId) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text/plain");
    const el = document.getElementById(id);
    const targetSlot = document.getElementById(targetSlotId);
    if (el && targetSlot) {
        // clear previous child if any
        if (targetSlot.firstChild) {
            document.getElementById("quiz-draggable-source-area").appendChild(targetSlot.firstChild);
        }
        targetSlot.appendChild(el);
    }
}
