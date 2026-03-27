(function () {
  var DEFAULT_BALANCE = 30000;
  var STORAGE_KEYS = {
    balance: "casino830_balance",
    lastGame: "casino830_last_game",
    sound: "casino830_sound_enabled",
  };
  var GAME_META = {
    slots: { name: "Slots", path: "games/slots.html" },
    blackjack: { name: "Blackjack", path: "games/blackjack.html" },
    roulette: { name: "Roulette", path: "games/roulette.html" },
    mines: { name: "Mines", path: "games/mines.html" },
    limbo: { name: "Limbo", path: "games/limbo.html" },
    plinko: { name: "Plinko", path: "games/plinko.html" },
    dice: { name: "Dice", path: "games/dice.html" },
    crash: { name: "Crash", path: "games/crash.html" },
  };

  var displayedBalance = readNumber(STORAGE_KEYS.balance, DEFAULT_BALANCE);
  var balanceFrame = 0;
  var audioContext = null;

  function formatCurrency(amount) {
    var rounded = Math.round(Number(amount) || 0);
    return "$" + rounded.toLocaleString("en-US");
  }

  function formatMultiplier(multiplier) {
    return Number(multiplier || 0).toFixed(2) + "x";
  }

  function normalizeBet(value, options) {
    var settings = options || {};
    var fallback = settings.fallback || 500;
    var min = settings.min || 100;
    var step = settings.step || 100;
    var numeric = Number(value);
    var safe = isFinite(numeric) ? numeric : fallback;
    var stepped = Math.round(safe / step) * step;
    return Math.max(min, Math.round(stepped));
  }

  function readStorage(key, fallback) {
    if (typeof localStorage === "undefined") {
      return fallback;
    }

    try {
      var value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Ignore storage errors so the static site still works in restrictive contexts.
    }
  }

  function readNumber(key, fallback) {
    var raw = readStorage(key, "");
    var parsed = Number(raw);
    return isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
  }

  function readBoolean(key, fallback) {
    var raw = readStorage(key, "");
    if (raw === "") {
      return fallback;
    }

    return raw === "true";
  }

  function getBalance() {
    return readNumber(STORAGE_KEYS.balance, DEFAULT_BALANCE);
  }

  function getSoundEnabled() {
    return readBoolean(STORAGE_KEYS.sound, true);
  }

  function getLastGameId() {
    var lastGame = readStorage(STORAGE_KEYS.lastGame, "");
    return GAME_META[lastGame] ? lastGame : "";
  }

  function getGamePath(gameId) {
    return GAME_META[gameId] ? GAME_META[gameId].path : GAME_META.slots.path;
  }

  function getGameName(gameId) {
    return GAME_META[gameId] ? GAME_META[gameId].name : GAME_META.slots.name;
  }

  function getRelativeGamePath(gameId) {
    var path = getGamePath(gameId);
    var isGamePage = document.body && document.body.getAttribute("data-page-type") === "game";
    return isGamePage ? "../" + path : path;
  }

  function emitBalanceChange(balance) {
    if (typeof document === "undefined") {
      return;
    }

    document.dispatchEvent(
      new CustomEvent("casino830:balancechange", {
        detail: { balance: balance },
      })
    );
  }

  function updateBalanceDisplays(value) {
    var displays = document.querySelectorAll("[data-balance-display]");
    var formatted = formatCurrency(value);
    var index;

    for (index = 0; index < displays.length; index += 1) {
      displays[index].textContent = formatted;
    }
  }

  function syncBalanceDisplays(instant) {
    var target = getBalance();

    if (balanceFrame) {
      cancelAnimationFrame(balanceFrame);
      balanceFrame = 0;
    }

    if (instant || typeof window.requestAnimationFrame !== "function") {
      displayedBalance = target;
      updateBalanceDisplays(displayedBalance);
      return;
    }

    var startValue = displayedBalance;
    var difference = target - startValue;

    if (!difference) {
      updateBalanceDisplays(target);
      return;
    }

    var duration = Math.min(950, 260 + Math.abs(difference) / 40);
    var startTime = performance.now();

    function animate(timestamp) {
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      displayedBalance = Math.round(startValue + difference * eased);
      updateBalanceDisplays(displayedBalance);

      if (progress < 1) {
        balanceFrame = requestAnimationFrame(animate);
        return;
      }

      displayedBalance = target;
      updateBalanceDisplays(displayedBalance);
    }

    balanceFrame = requestAnimationFrame(animate);
  }

  function setBalance(nextBalance, instant) {
    var balance = Math.max(0, Math.round(Number(nextBalance) || 0));
    writeStorage(STORAGE_KEYS.balance, String(balance));
    syncBalanceDisplays(Boolean(instant));
    emitBalanceChange(balance);
  }

  function saveLastGame(gameId) {
    if (!GAME_META[gameId]) {
      return;
    }

    writeStorage(STORAGE_KEYS.lastGame, gameId);
    syncLastPlayedUi();
  }

  function syncLastPlayedUi() {
    var lastGameId = getLastGameId();
    var lastGameName = lastGameId ? getGameName(lastGameId) : "Any game";
    var lastGameHint = lastGameId
      ? "Open it again."
      : "Play to save it.";
    var lastGameChip = lastGameId ? "Recent: " + lastGameName : "No recent game";
    var continueText = "Continue";
    var continueLinks = document.querySelectorAll("[data-continue-link]");
    var nameNodes = document.querySelectorAll("[data-last-played-name]");
    var hintNodes = document.querySelectorAll("[data-last-played-hint]");
    var chipNodes = document.querySelectorAll("[data-last-played-chip]");
    var index;

    for (index = 0; index < continueLinks.length; index += 1) {
      continueLinks[index].setAttribute("href", getRelativeGamePath(lastGameId || "slots"));
      continueLinks[index].textContent = continueText;
    }

    for (index = 0; index < nameNodes.length; index += 1) {
      nameNodes[index].textContent = lastGameName;
    }

    for (index = 0; index < hintNodes.length; index += 1) {
      hintNodes[index].textContent = lastGameHint;
    }

    for (index = 0; index < chipNodes.length; index += 1) {
      chipNodes[index].textContent = lastGameChip;
    }
  }

  function syncSoundButtons() {
    var enabled = getSoundEnabled();
    var buttons = document.querySelectorAll("[data-sound-toggle]");
    var index;

    for (index = 0; index < buttons.length; index += 1) {
      buttons[index].textContent = enabled ? "Sound: On" : "Sound: Off";
      buttons[index].setAttribute("aria-pressed", enabled ? "true" : "false");
    }
  }

  function bindResetButtons() {
    var buttons = document.querySelectorAll("[data-reset-balance]");
    var index;

    for (index = 0; index < buttons.length; index += 1) {
      if (buttons[index].getAttribute("data-bound") === "true") {
        continue;
      }

      buttons[index].setAttribute("data-bound", "true");
      buttons[index].addEventListener("click", function () {
        var confirmed = window.confirm("Reset the demo balance back to $30,000?");
        if (!confirmed) {
          return;
        }

        setBalance(DEFAULT_BALANCE);
        showToast("Balance reset to $30,000.", "info");
      });
    }
  }

  function bindSoundButtons() {
    var buttons = document.querySelectorAll("[data-sound-toggle]");
    var index;

    for (index = 0; index < buttons.length; index += 1) {
      if (buttons[index].getAttribute("data-bound") === "true") {
        continue;
      }

      buttons[index].setAttribute("data-bound", "true");
      buttons[index].addEventListener("click", function () {
        var enabled = !getSoundEnabled();
        writeStorage(STORAGE_KEYS.sound, enabled ? "true" : "false");
        syncSoundButtons();
        showToast(enabled ? "Sound enabled." : "Sound muted.", "info");
      });
    }
  }

  function ensureToastStack() {
    var stack = document.getElementById("toastStack");
    if (stack) {
      return stack;
    }

    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    stack.setAttribute("aria-live", "polite");
    stack.setAttribute("aria-atomic", "true");
    document.body.appendChild(stack);
    return stack;
  }

  function showToast(message, variant) {
    var stack = ensureToastStack();
    var toast = document.createElement("div");
    toast.className = "toast " + (variant || "info");
    toast.textContent = message;
    stack.appendChild(toast);

    window.setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      window.setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 220);
    }, 3200);
  }

  function playSound(type) {
    if (!getSoundEnabled()) {
      return;
    }

    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    try {
      if (!audioContext) {
        audioContext = new AudioContextClass();
      }

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      var presets = {
        bet: { frequency: 210, duration: 0.14, gain: 0.045, tone: "sine" },
        win: { frequency: 520, duration: 0.22, gain: 0.08, tone: "triangle" },
        error: { frequency: 140, duration: 0.18, gain: 0.06, tone: "sawtooth" },
        info: { frequency: 310, duration: 0.16, gain: 0.045, tone: "sine" },
      };
      var preset = presets[type] || presets.info;
      var now = audioContext.currentTime;
      var oscillator = audioContext.createOscillator();
      var gainNode = audioContext.createGain();

      oscillator.type = preset.tone;
      oscillator.frequency.setValueAtTime(preset.frequency, now);
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(preset.gain, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + preset.duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + preset.duration + 0.02);
    } catch (error) {
      // Optional enhancement only.
    }
  }

  function takeBet(value, options) {
    var amount = normalizeBet(value, options || {});
    var balance = getBalance();

    if (amount > balance) {
      showToast("Balance too low for " + formatCurrency(amount) + ".", "error");
      playSound("error");
      return 0;
    }

    setBalance(balance - amount);
    playSound("bet");
    return amount;
  }

  function creditWinnings(amount) {
    var safe = Math.max(0, Math.round(Number(amount) || 0));
    if (!safe) {
      return 0;
    }

    setBalance(getBalance() + safe);
    playSound("win");
    return safe;
  }

  function refund(amount) {
    var safe = Math.max(0, Math.round(Number(amount) || 0));
    if (!safe) {
      return 0;
    }

    setBalance(getBalance() + safe);
    playSound("info");
    return safe;
  }

  function bindCommon() {
    syncBalanceDisplays(true);
    syncLastPlayedUi();
    syncSoundButtons();
    bindResetButtons();
    bindSoundButtons();
  }

  function createGameApi(gameId) {
    saveLastGame(gameId);
    bindCommon();

    return {
      closeModal: function () {},
      creditWinnings: creditWinnings,
      formatCurrency: formatCurrency,
      formatMultiplier: formatMultiplier,
      getBalance: getBalance,
      getCategoryLabel: function (category) {
        if (category === "slots") {
          return "Slots";
        }
        if (category === "table") {
          return "Table Games";
        }
        if (category === "originals") {
          return "Originals";
        }
        return "Game";
      },
      normalizeBet: normalizeBet,
      playSound: playSound,
      refund: refund,
      showToast: showToast,
      takeBet: takeBet,
    };
  }

  window.addEventListener("storage", function () {
    syncBalanceDisplays(true);
    syncLastPlayedUi();
    syncSoundButtons();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindCommon);
  } else {
    bindCommon();
  }

  window.Casino830Site = {
    bindCommon: bindCommon,
    createGameApi: createGameApi,
    creditWinnings: creditWinnings,
    formatCurrency: formatCurrency,
    formatMultiplier: formatMultiplier,
    getBalance: getBalance,
    getGameName: getGameName,
    getGamePath: getGamePath,
    normalizeBet: normalizeBet,
    playSound: playSound,
    refund: refund,
    saveLastGame: saveLastGame,
    setBalance: setBalance,
    showToast: showToast,
    syncBalanceDisplays: syncBalanceDisplays,
    takeBet: takeBet,
  };
})();
