const {
  createSlotsGame,
  createBlackjackGame,
  createRouletteGame,
  createDiceGame,
  createCrashGame,
} = window.Casino830Games || {};

const DEFAULT_BALANCE = 30000;
const STORAGE_KEYS = {
  balance: "casino830_balance",
  lastGame: "casino830_last_game",
  sound: "casino830_sound_enabled",
};

const CATEGORY_CONFIG = {
  all: { label: "All Games" },
  slots: { label: "Slots" },
  table: { label: "Table Games" },
  originals: { label: "Originals" },
};

const GAME_DEFINITIONS = [
  {
    id: "slots",
    name: "Slots",
    category: "slots",
    thumbnail: "777",
    subline: "Rapid Reels",
    tag: "3 reels",
    description: "Three-reel demo play with clean multipliers and quick spin pacing.",
    create: createSlotsGame,
  },
  {
    id: "blackjack",
    name: "Blackjack",
    category: "table",
    thumbnail: "A K",
    subline: "Dealer Duel",
    tag: "hit / stand",
    description: "A streamlined player-versus-dealer table built around familiar blackjack rules.",
    create: createBlackjackGame,
  },
  {
    id: "roulette",
    name: "Roulette",
    category: "table",
    thumbnail: "0 17 32",
    subline: "Wheel Spin",
    tag: "red / black / number",
    description: "Spin a fully animated wheel and back red, black, or a single number.",
    create: createRouletteGame,
  },
  {
    id: "dice",
    name: "Dice",
    category: "originals",
    thumbnail: "52.41",
    subline: "Risk Slider",
    tag: "tunable odds",
    description: "Dial your risk, watch the odds shift live, and roll for a multiplier.",
    create: createDiceGame,
  },
  {
    id: "crash",
    name: "Crash",
    category: "originals",
    thumbnail: "x4.28",
    subline: "Cash Out",
    tag: "timing game",
    description: "Ride an accelerating multiplier and cash out before the round crashes.",
    create: createCrashGame,
  },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

let ui = null;
let appRoot = null;
let activeController = null;
let displayedBalance = readNumber(STORAGE_KEYS.balance, DEFAULT_BALANCE);
let balanceFrame = 0;
let modalTimer = 0;
let audioContext = null;

const state = {
  balance: readNumber(STORAGE_KEYS.balance, DEFAULT_BALANCE),
  lastGame: readString(STORAGE_KEYS.lastGame, ""),
  soundEnabled: readBoolean(STORAGE_KEYS.sound, true),
  category: "all",
};

if (!getGameById(state.lastGame)) {
  state.lastGame = "";
}

const root = typeof document !== "undefined" ? document.querySelector('[data-app="casino830"]') : null;

if (root) {
  init(root);
}

function init(rootElement) {
  appRoot = rootElement;
  ui = {
    sidebar: document.getElementById("sidebar"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    categoryButtons: Array.from(document.querySelectorAll("[data-category]")),
    balanceDisplay: document.getElementById("balanceDisplay"),
    heroBalance: document.getElementById("heroBalance"),
    modalBalance: document.getElementById("modalBalance"),
    resetBalanceBtn: document.getElementById("resetBalanceBtn"),
    soundToggle: document.getElementById("soundToggle"),
    continueGameBtn: document.getElementById("continueGameBtn"),
    browseGamesBtn: document.getElementById("browseGamesBtn"),
    lastPlayedDisplay: document.getElementById("lastPlayedDisplay"),
    lastPlayedHint: document.getElementById("lastPlayedHint"),
    lastPlayedChip: document.getElementById("lastPlayedChip"),
    sectionTitle: document.getElementById("sectionTitle"),
    sectionTag: document.getElementById("sectionTag"),
    gameGrid: document.getElementById("gameGrid"),
    gameModal: document.getElementById("gameModal"),
    modalTitle: document.getElementById("modalTitle"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    modalLoading: document.getElementById("modalLoading"),
    gameMount: document.getElementById("gameMount"),
    toastStack: document.getElementById("toastStack"),
  };

  bindEvents();
  syncBalance(true);
  syncSoundToggle();
  updateLastPlayedUI();
  updateCategoryUI();
  renderGameGrid();
}

function bindEvents() {
  ui.sidebarToggle.addEventListener("click", () => {
    if (isMobileViewport()) {
      appRoot.classList.toggle("sidebar-open");
      return;
    }

    appRoot.classList.toggle("sidebar-collapsed");
  });

  ui.categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      updateCategoryUI();
      renderGameGrid();

      if (isMobileViewport()) {
        appRoot.classList.remove("sidebar-open");
      }
    });
  });

  ui.gameGrid.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-game]");
    if (!trigger) {
      return;
    }

    event.preventDefault();
    openGame(trigger.dataset.openGame);
  });

  ui.gameGrid.addEventListener("keydown", (event) => {
    const card = event.target.closest(".game-card");
    if (!card || !["Enter", " "].includes(event.key)) {
      return;
    }

    event.preventDefault();
    openGame(card.dataset.openGame);
  });

  ui.continueGameBtn.addEventListener("click", () => {
    openGame(state.lastGame || "slots");
  });

  ui.browseGamesBtn.addEventListener("click", () => {
    ui.gameGrid.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  ui.resetBalanceBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Reset the demo balance back to $30,000?");
    if (!confirmed) {
      return;
    }

    closeModal();
    setBalance(DEFAULT_BALANCE);
    showToast("Balance reset to $30,000.", "info");
  });

  ui.soundToggle.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    writeStorage(STORAGE_KEYS.sound, String(state.soundEnabled));
    syncSoundToggle();
    showToast(state.soundEnabled ? "Sound enabled." : "Sound muted.", "info");
  });

  ui.closeModalBtn.addEventListener("click", closeModal);

  ui.gameModal.addEventListener("click", (event) => {
    if (event.target === ui.gameModal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });

  document.addEventListener("click", (event) => {
    if (!isMobileViewport() || !appRoot.classList.contains("sidebar-open")) {
      return;
    }

    const clickedInsideSidebar = event.target.closest("#sidebar");
    const clickedToggle = event.target.closest("#sidebarToggle");
    if (!clickedInsideSidebar && !clickedToggle) {
      appRoot.classList.remove("sidebar-open");
    }
  });

  window.addEventListener("resize", () => {
    if (!isMobileViewport()) {
      appRoot.classList.remove("sidebar-open");
    }
  });
}

function renderGameGrid() {
  const games = state.category === "all"
    ? GAME_DEFINITIONS
    : GAME_DEFINITIONS.filter((game) => game.category === state.category);

  ui.gameGrid.innerHTML = games
    .map((game) => {
      const badgeLabel = state.lastGame === game.id ? "Last played" : game.tag;
      return `
        <article
          class="game-card"
          data-game="${game.id}"
          data-open-game="${game.id}"
          tabindex="0"
          role="button"
          aria-label="Open ${game.name}"
        >
          <div class="game-card-media">
            <span class="mini-badge card-category">${CATEGORY_CONFIG[game.category].label}</span>
            <div class="thumbnail-symbol">${game.thumbnail}</div>
            <div class="thumbnail-subline">${game.subline}</div>
          </div>
          <div class="game-card-content">
            <div>
              <h3>${game.name}</h3>
              <p>${game.description}</p>
            </div>
            <div class="game-card-footer">
              <span class="pill-chip">${badgeLabel}</span>
              <button class="play-button" type="button" data-open-game="${game.id}">
                Play
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateCategoryUI() {
  ui.categoryButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.category === state.category);
  });

  const activeGames = state.category === "all"
    ? GAME_DEFINITIONS
    : GAME_DEFINITIONS.filter((game) => game.category === state.category);

  ui.sectionTitle.textContent = CATEGORY_CONFIG[state.category].label;
  ui.sectionTag.textContent = `${activeGames.length} ${activeGames.length === 1 ? "game" : "games"} ready`;
}

function updateLastPlayedUI() {
  const lastGame = getGameById(state.lastGame);
  ui.lastPlayedDisplay.textContent = lastGame ? lastGame.name : "Pick any game";
  ui.lastPlayedHint.textContent = lastGame
    ? `Resume ${lastGame.name} instantly from the lobby.`
    : "Nothing stored yet.";
  ui.lastPlayedChip.textContent = lastGame
    ? `Last played: ${lastGame.name}`
    : "No last game yet";
  ui.continueGameBtn.textContent = lastGame
    ? `Continue ${lastGame.name}`
    : "Start With Slots";
}

function openGame(gameId) {
  const game = getGameById(gameId);
  if (!game) {
    return;
  }

  saveLastGame(game.id);
  teardownActiveGame();

  ui.modalTitle.textContent = game.name;
  ui.gameMount.innerHTML = "";
  ui.modalLoading.hidden = false;
  ui.gameModal.classList.add("is-open");
  ui.gameModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  if (isMobileViewport()) {
    appRoot.classList.remove("sidebar-open");
  }

  modalTimer = window.setTimeout(() => {
    ui.modalLoading.hidden = true;
    activeController = game.create({ app: appApi, meta: game });
    activeController.mount(ui.gameMount);
    ui.closeModalBtn.focus();
  }, 240);
}

function closeModal() {
  if (!ui || !ui.gameModal.classList.contains("is-open")) {
    return;
  }

  if (modalTimer) {
    window.clearTimeout(modalTimer);
    modalTimer = 0;
  }

  teardownActiveGame();
  ui.modalLoading.hidden = true;
  ui.gameMount.innerHTML = "";
  ui.gameModal.classList.remove("is-open");
  ui.gameModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function teardownActiveGame() {
  if (modalTimer) {
    window.clearTimeout(modalTimer);
    modalTimer = 0;
  }

  if (activeController && typeof activeController.destroy === "function") {
    activeController.destroy();
  }

  activeController = null;
}

function saveLastGame(gameId) {
  state.lastGame = gameId;
  writeStorage(STORAGE_KEYS.lastGame, gameId);
  updateLastPlayedUI();
  renderGameGrid();
}

function setBalance(nextBalance, instant = false) {
  state.balance = Math.max(0, Math.round(nextBalance));
  writeStorage(STORAGE_KEYS.balance, String(state.balance));
  syncBalance(instant);
  emitBalanceChange();
}

// Animate the visible balance so bankroll updates feel like a live wallet, not a text swap.
function syncBalance(instant = false) {
  const target = state.balance;

  if (balanceFrame) {
    cancelAnimationFrame(balanceFrame);
    balanceFrame = 0;
  }

  if (instant) {
    displayedBalance = target;
    updateBalanceDisplays(displayedBalance);
    return;
  }

  const startValue = displayedBalance;
  const difference = target - startValue;
  if (!difference) {
    updateBalanceDisplays(target);
    return;
  }

  const duration = Math.min(950, 260 + Math.abs(difference) / 40);
  const startTime = performance.now();

  const animate = (timestamp) => {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    displayedBalance = Math.round(startValue + difference * eased);
    updateBalanceDisplays(displayedBalance);

    if (progress < 1) {
      balanceFrame = requestAnimationFrame(animate);
      return;
    }

    displayedBalance = target;
    updateBalanceDisplays(target);
  };

  balanceFrame = requestAnimationFrame(animate);
}

function updateBalanceDisplays(value) {
  const formatted = formatCurrency(value);
  ui.balanceDisplay.textContent = formatted;
  ui.heroBalance.textContent = formatted;
  ui.modalBalance.textContent = formatted;
}

function syncSoundToggle() {
  ui.soundToggle.textContent = state.soundEnabled ? "Sound: On" : "Sound: Off";
  ui.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
}

function showToast(message, variant = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${variant}`;
  toast.textContent = message;
  ui.toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    window.setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function playSound(type = "info") {
  if (!state.soundEnabled) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  try {
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const toneMap = {
      bet: { frequency: 210, duration: 0.14, gain: 0.045, type: "sine" },
      win: { frequency: 520, duration: 0.22, gain: 0.08, type: "triangle" },
      error: { frequency: 140, duration: 0.18, gain: 0.06, type: "sawtooth" },
      info: { frequency: 310, duration: 0.16, gain: 0.045, type: "sine" },
    };

    const preset = toneMap[type] || toneMap.info;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = preset.type;
    oscillator.frequency.setValueAtTime(preset.frequency, now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(preset.gain, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + preset.duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + preset.duration + 0.02);
  } catch {
    // Sound is optional, so a failed beep should never block gameplay.
  }
}

function emitBalanceChange() {
  if (typeof document === "undefined") {
    return;
  }

  document.dispatchEvent(
    new CustomEvent("casino830:balancechange", {
      detail: { balance: state.balance },
    }),
  );
}

function readNumber(key, fallback) {
  const rawValue = readString(key, "");
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

function readBoolean(key, fallback) {
  const rawValue = readString(key, "");
  if (rawValue === "") {
    return fallback;
  }

  return rawValue === "true";
}

function readString(key, fallback) {
  if (typeof localStorage === "undefined") {
    return fallback;
  }

  try {
    const value = localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors so the demo still works in restrictive contexts.
  }
}

function getGameById(gameId) {
  return GAME_DEFINITIONS.find((game) => game.id === gameId) || null;
}

function getCategoryLabel(category) {
  return CATEGORY_CONFIG[category]?.label || "Game";
}

function formatCurrency(amount) {
  return currencyFormatter.format(Math.round(amount));
}

function formatMultiplier(multiplier) {
  return `${Number(multiplier).toFixed(2)}x`;
}

function normalizeBet(value, options = {}) {
  const { fallback = 500, min = 100, step = 100 } = options;
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : fallback;
  const stepped = step > 0 ? Math.round(safe / step) * step : safe;
  return Math.max(min, Math.round(stepped));
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 980px)").matches;
}

const appApi = {
  closeModal,
  formatCurrency,
  formatMultiplier,
  getBalance: () => state.balance,
  getCategoryLabel,
  normalizeBet,
  playSound,
  showToast,
  takeBet(value, options = {}) {
    const amount = normalizeBet(value, options);

    if (amount > state.balance) {
      showToast(`Balance too low for ${formatCurrency(amount)}.`, "error");
      playSound("error");
      return 0;
    }

    setBalance(state.balance - amount);
    playSound("bet");
    return amount;
  },
  creditWinnings(amount) {
    const safe = Math.max(0, Math.round(amount));
    if (!safe) {
      return 0;
    }

    setBalance(state.balance + safe);
    playSound("win");
    return safe;
  },
  refund(amount) {
    const safe = Math.max(0, Math.round(amount));
    if (!safe) {
      return 0;
    }

    setBalance(state.balance + safe);
    playSound("info");
    return safe;
  },
};
