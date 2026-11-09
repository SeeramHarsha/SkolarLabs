/* SpeechSynthesis voice narration controller */
const VoiceManager = {
  synth: window.speechSynthesis,
  utterance: null,
  isPlaying: false,
  isPaused: false,
  rate: 1.0,
  currentText: "",
  onUpdateCallback: null,

  init() {
    this.synth.cancel(); // Reset any ongoing audio queues
  },

  speak(text) {
    if (!text || text.trim() === "") return;
    this.synth.cancel();
    this.currentText = text;
    this.isPlaying = true;
    this.isPaused = false;

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.rate = this.rate;

    // Show visual subtitles
    const subtitleEl = document.getElementById("voice-subtitle");
    if (subtitleEl) {
      subtitleEl.innerText = text;
      subtitleEl.classList.add("active");
    }

    this.utterance.onend = () => {
      this.isPlaying = false;
      this.isPaused = false;
      if (subtitleEl) {
        subtitleEl.classList.remove("active");
      }
      if (this.onUpdateCallback) this.onUpdateCallback();
    };

    this.utterance.onerror = () => {
      this.isPlaying = false;
      this.isPaused = false;
      if (subtitleEl) {
        subtitleEl.classList.remove("active");
      }
      if (this.onUpdateCallback) this.onUpdateCallback();
    };

    this.synth.speak(this.utterance);
    if (this.onUpdateCallback) this.onUpdateCallback();
  },

  pause() {
    if (this.isPlaying && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
      if (this.onUpdateCallback) this.onUpdateCallback();
    }
  },

  resume() {
    if (this.isPlaying && this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
      if (this.onUpdateCallback) this.onUpdateCallback();
    }
  },

  stop() {
    this.synth.cancel();
    this.isPlaying = false;
    this.isPaused = false;
    const subtitleEl = document.getElementById("voice-subtitle");
    if (subtitleEl) {
      subtitleEl.classList.remove("active");
    }
    if (this.onUpdateCallback) this.onUpdateCallback();
  },

  setRate(newRate) {
    this.rate = newRate;
    if (this.isPlaying) {
      // Re-run speech with new speed rate
      this.speak(this.currentText);
    }
  },

  registerCallback(cb) {
    this.onUpdateCallback = cb;
  }
};
window.VoiceManager = VoiceManager;
VoiceManager.init();
