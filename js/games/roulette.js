const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

window.Casino830Games = window.Casino830Games || {};

function createRouletteGame({ app }) {
  const abortController = new AbortController();
  const timeouts = new Set();
  let spinning = false;
  let selectedColor = "red";
  let selectedNumber = null;
  let currentRotation = 0;

  function mount(container) {
    container.innerHTML = `
      <div class="game-shell">
        <section class="game-panel game-stage">
          <div class="panel-header">
            <div class="panel-title">
              <h3>Roulette</h3>
              <p>Bet color or number.</p>
            </div>
            <span class="pill-chip">Animated wheel</span>
          </div>

          <div class="roulette-stage">
            <div class="wheel-shell">
              <div class="wheel-pointer"></div>
              <div class="wheel-disc" id="rouletteWheel">
                ${buildWheelMarkers()}
                <div class="wheel-core">
                  <strong id="rouletteResultNumber">--</strong>
                  <small id="rouletteResultLabel">Awaiting</small>
                </div>
              </div>
            </div>

            <p class="wheel-status" id="rouletteStatus">
              Pick a bet and spin.
            </p>

            <div class="selection-grid">
              <article class="selection-card">
                <span>Selection</span>
                <strong id="rouletteSelection">Red</strong>
                <small>Numbers 36.00x. Colors 2.00x.</small>
              </article>
              <article class="selection-card">
                <span>Potential Return</span>
                <strong id="roulettePotential">${app.formatCurrency(1000)}</strong>
                <small>Updates with bet size.</small>
              </article>
            </div>
          </div>
        </section>

        <aside class="game-panel control-panel">
          <div class="panel-title">
            <h3>Bet Controls</h3>
            <p>Choose one bet type.</p>
          </div>

          <div class="control-stack">
            <label for="rouletteBet">Bet Amount</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="rouletteBetDown" aria-label="Lower bet">-</button>
              <input class="number-input" id="rouletteBet" type="number" min="100" step="100" value="500" />
              <button class="chip-button" type="button" id="rouletteBetUp" aria-label="Raise bet">+</button>
            </div>
          </div>

          <div class="control-stack">
            <label>Color Bet</label>
            <div class="chip-row">
              <button class="color-chip red selected" type="button" data-color="red">Red</button>
              <button class="color-chip black" type="button" data-color="black">Black</button>
            </div>
          </div>

          <div class="control-stack">
            <label>Number Bet</label>
            <div class="roulette-board" id="rouletteBoard">
              ${renderRouletteNumberButton(0)}
              ${Array.from({ length: 36 }, (_, index) => index + 1)
                .map((number) => renderRouletteNumberButton(number))
                .join("")}
            </div>
          </div>

          <div class="action-row">
            <button class="primary-action" type="button" id="rouletteSpin">Spin</button>
          </div>
        </aside>
      </div>
    `;

    const wheelElement = container.querySelector("#rouletteWheel");
    const resultNumberElement = container.querySelector("#rouletteResultNumber");
    const resultLabelElement = container.querySelector("#rouletteResultLabel");
    const selectionElement = container.querySelector("#rouletteSelection");
    const potentialElement = container.querySelector("#roulettePotential");
    const statusElement = container.querySelector("#rouletteStatus");
    const betInput = container.querySelector("#rouletteBet");
    const spinButton = container.querySelector("#rouletteSpin");

    wheelElement.style.background = buildWheelGradient();

    const updateSelectionUI = () => {
      const previewBet = app.normalizeBet(betInput.value, { fallback: 500, min: 100, step: 100 });
      const label = selectedNumber !== null
        ? `Number ${selectedNumber}`
        : selectedColor === "black"
          ? "Black"
          : "Red";
      const multiplier = selectedNumber !== null ? 36 : 2;

      selectionElement.textContent = label;
      potentialElement.textContent = app.formatCurrency(previewBet * multiplier);

      container.querySelectorAll("[data-color]").forEach((button) => {
        button.classList.toggle("selected", button.dataset.color === selectedColor && selectedNumber === null);
      });

      container.querySelectorAll("[data-number]").forEach((button) => {
        button.classList.toggle("selected", Number(button.dataset.number) === selectedNumber);
      });
    };

    const adjustBet = (delta) => {
      const next = app.normalizeBet(Number(betInput.value || 0) + delta, {
        fallback: 500,
        min: 100,
        step: 100,
      });
      betInput.value = String(next);
      updateSelectionUI();
    };

    const queueTimeout = (callback, delay) => {
      const timeoutId = window.setTimeout(() => {
        timeouts.delete(timeoutId);
        callback();
      }, delay);
      timeouts.add(timeoutId);
    };

    container.querySelector("#rouletteBetDown").addEventListener(
      "click",
      () => adjustBet(-100),
      { signal: abortController.signal },
    );
    container.querySelector("#rouletteBetUp").addEventListener(
      "click",
      () => adjustBet(100),
      { signal: abortController.signal },
    );
    betInput.addEventListener("input", updateSelectionUI, { signal: abortController.signal });

    container.querySelectorAll("[data-color]").forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          selectedColor = button.dataset.color;
          selectedNumber = null;
          updateSelectionUI();
        },
        { signal: abortController.signal },
      );
    });

    container.querySelectorAll("[data-number]").forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          selectedNumber = Number(button.dataset.number);
          selectedColor = null;
          updateSelectionUI();
        },
        { signal: abortController.signal },
      );
    });

    spinButton.addEventListener(
      "click",
      () => {
        if (spinning) {
          return;
        }

        const wager = app.takeBet(betInput.value, { fallback: 500, min: 100, step: 100 });
        if (!wager) {
          return;
        }

        betInput.value = String(wager);
        updateSelectionUI();
        spinning = true;
        spinButton.disabled = true;
        resultNumberElement.textContent = "--";
        resultLabelElement.textContent = "Spinning";

        const result = Math.floor(Math.random() * 37);
        const resultColor = getNumberColor(result);
        const sliceAngle = 360 / WHEEL_ORDER.length;
        const wheelIndex = WHEEL_ORDER.indexOf(result);
        const targetAngle = wheelIndex * sliceAngle + sliceAngle / 2;

        currentRotation += 1440 + (360 - targetAngle);
        wheelElement.style.transform = `rotate(${currentRotation}deg)`;
        statusElement.textContent = `Wheel spinning on ${selectionElement.textContent} for ${app.formatCurrency(wager)}...`;

        queueTimeout(() => {
          const payout = selectedNumber !== null
            ? (result === selectedNumber ? wager * 36 : 0)
            : (resultColor === selectedColor ? wager * 2 : 0);

          resultNumberElement.textContent = String(result);
          resultLabelElement.textContent = resultColor.toUpperCase();

          if (payout > 0) {
            app.creditWinnings(payout);
            statusElement.textContent = `Result ${result} ${resultColor}. ${app.formatCurrency(payout)} returned.`;
            app.showToast(`Roulette hit ${result} ${resultColor}.`, "success");
          } else {
            statusElement.textContent = `Result ${result} ${resultColor}. This spin missed.`;
            app.showToast(`Roulette landed on ${result} ${resultColor}.`, "error");
          }

          spinning = false;
          spinButton.disabled = false;
        }, 2300);
      },
      { signal: abortController.signal },
    );

    updateSelectionUI();
  }

  function destroy() {
    abortController.abort();
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeouts.clear();
  }

  return { mount, destroy };
}

window.Casino830Games.createRouletteGame = createRouletteGame;

function getNumberColor(number) {
  if (number === 0) {
    return "green";
  }

  return RED_NUMBERS.has(number) ? "red" : "black";
}

function buildWheelGradient() {
  const sliceAngle = 360 / WHEEL_ORDER.length;
  return `conic-gradient(${WHEEL_ORDER.map((number, index) => {
    const start = Number((index * sliceAngle).toFixed(2));
    const end = Number(((index + 1) * sliceAngle).toFixed(2));
    const color = getNumberColor(number) === "red"
      ? "#a5222a"
      : getNumberColor(number) === "green"
        ? "#14845d"
        : "#10181f";
    return `${color} ${start}deg ${end}deg`;
  }).join(", ")})`;
}

function buildWheelMarkers() {
  const sliceAngle = 360 / WHEEL_ORDER.length;

  return WHEEL_ORDER.map((number, index) => {
    const angle = index * sliceAngle + sliceAngle / 2;
    const color = getNumberColor(number);
    return `
      <span
        class="wheel-number-marker ${color}"
        style="transform: translate(-50%, -50%) rotate(${angle}deg) translateY(-8.8rem) rotate(${-angle}deg);"
      >
        ${number}
      </span>
    `;
  }).join("");
}

function renderRouletteNumberButton(number) {
  const color = getNumberColor(number);
  const zeroClass = number === 0 ? " zero" : "";

  return `
    <button class="number-chip ${color}${zeroClass}" type="button" data-number="${number}">
      <span class="number-chip-value">${number}</span>
      <span class="roulette-chip-marker" aria-hidden="true"></span>
    </button>
  `;
}
