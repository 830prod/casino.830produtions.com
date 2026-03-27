window.Casino830Games = window.Casino830Games || {};

function createDiceGame({ app }) {
  const abortController = new AbortController();
  const timeouts = new Set();
  const intervals = new Set();
  let rolling = false;

  function mount(container) {
    container.innerHTML = `
      <div class="game-shell">
        <section class="game-panel game-stage">
          <div class="panel-header">
            <div class="panel-title">
              <h3>Dice</h3>
              <p>Roll under the line.</p>
            </div>
            <span class="pill-chip">Originals</span>
          </div>

          <div class="dice-stage">
            <div class="dice-display">
              <div>
                <div class="dice-roll-value" id="diceRollValue">--.--</div>
                <p class="wheel-status" id="diceStatus">Roll to start.</p>
              </div>
            </div>

            <div class="selection-grid">
              <article class="selection-card">
                <span>Win Chance</span>
                <strong id="diceChance">59.60%</strong>
                <small id="diceThreshold">Under 59.60 wins.</small>
              </article>
              <article class="selection-card">
                <span>Projected Return</span>
                <strong id="diceMultiplier">1.64x</strong>
                <small id="diceRiskLabel">Medium risk profile.</small>
              </article>
            </div>
          </div>
        </section>

        <aside class="game-panel control-panel">
          <div class="panel-title">
            <h3>Risk Controls</h3>
            <p>Set bet and risk.</p>
          </div>

          <div class="control-stack">
            <label for="diceBet">Bet Amount</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="diceBetDown" aria-label="Lower bet">-</button>
              <input class="number-input" id="diceBet" type="number" min="100" step="100" value="500" />
              <button class="chip-button" type="button" id="diceBetUp" aria-label="Raise bet">+</button>
            </div>
          </div>

          <div class="control-stack">
            <label for="diceRisk">Risk Slider</label>
            <input class="range-input" id="diceRisk" type="range" min="10" max="90" step="1" value="45" />
            <div class="risk-line">
              <div class="risk-fill" id="diceRiskFill"></div>
            </div>
          </div>

          <div class="action-row">
            <button class="primary-action" type="button" id="diceRoll">Roll</button>
          </div>

          <div class="metric-card">
            <span>Returns</span>
            <small>Higher risk raises the return.</small>
          </div>
        </aside>
      </div>
    `;

    const rollValueElement = container.querySelector("#diceRollValue");
    const statusElement = container.querySelector("#diceStatus");
    const chanceElement = container.querySelector("#diceChance");
    const thresholdElement = container.querySelector("#diceThreshold");
    const multiplierElement = container.querySelector("#diceMultiplier");
    const riskLabelElement = container.querySelector("#diceRiskLabel");
    const riskInput = container.querySelector("#diceRisk");
    const riskFill = container.querySelector("#diceRiskFill");
    const betInput = container.querySelector("#diceBet");
    const rollButton = container.querySelector("#diceRoll");

    const adjustBet = (delta) => {
      const next = app.normalizeBet(Number(betInput.value || 0) + delta, {
        fallback: 500,
        min: 100,
        step: 100,
      });
      betInput.value = String(next);
      updateOddsUI();
    };

    const updateOddsUI = () => {
      const odds = deriveOdds(Number(riskInput.value));
      const previewBet = app.normalizeBet(betInput.value, { fallback: 500, min: 100, step: 100 });

      chanceElement.textContent = `${odds.chance.toFixed(2)}%`;
      thresholdElement.textContent = `Under ${odds.chance.toFixed(2)} wins.`;
      multiplierElement.textContent = app.formatMultiplier(odds.multiplier);
      riskLabelElement.textContent = `${odds.label} risk. ${app.formatCurrency(previewBet * odds.multiplier)} returned on win.`;
      riskFill.style.width = `${100 - odds.chance}%`;
    };

    const queueTimeout = (callback, delay) => {
      const timeoutId = window.setTimeout(() => {
        timeouts.delete(timeoutId);
        callback();
      }, delay);
      timeouts.add(timeoutId);
    };

    container.querySelector("#diceBetDown").addEventListener(
      "click",
      () => adjustBet(-100),
      { signal: abortController.signal },
    );
    container.querySelector("#diceBetUp").addEventListener(
      "click",
      () => adjustBet(100),
      { signal: abortController.signal },
    );
    riskInput.addEventListener("input", updateOddsUI, { signal: abortController.signal });
    betInput.addEventListener("input", updateOddsUI, { signal: abortController.signal });

    rollButton.addEventListener(
      "click",
      () => {
        if (rolling) {
          return;
        }

        const wager = app.takeBet(betInput.value, { fallback: 500, min: 100, step: 100 });
        if (!wager) {
          return;
        }

        const odds = deriveOdds(Number(riskInput.value));
        betInput.value = String(wager);
        updateOddsUI();
        rolling = true;
        rollButton.disabled = true;
        rollValueElement.classList.add("rolling");
        statusElement.textContent = `Rolling ${app.formatCurrency(wager)} at ${odds.label.toLowerCase()} risk...`;

        const intervalId = window.setInterval(() => {
          rollValueElement.textContent = (Math.random() * 100).toFixed(2);
        }, 70);
        intervals.add(intervalId);

        queueTimeout(() => {
          window.clearInterval(intervalId);
          intervals.delete(intervalId);

          const finalRoll = Number((Math.random() * 100).toFixed(2));
          const won = finalRoll < odds.chance;
          rollValueElement.textContent = finalRoll.toFixed(2);
          rollValueElement.classList.remove("rolling");

          if (won) {
            const payout = Math.round(wager * odds.multiplier);
            app.creditWinnings(payout);
            statusElement.textContent = `${finalRoll.toFixed(2)} stays under ${odds.chance.toFixed(2)}. ${app.formatCurrency(payout)} returned.`;
            app.showToast(`Dice connected at ${finalRoll.toFixed(2)}.`, "success");
          } else {
            statusElement.textContent = `${finalRoll.toFixed(2)} missed. Roll again.`;
            app.showToast(`Dice missed at ${finalRoll.toFixed(2)}.`, "error");
          }

          rolling = false;
          rollButton.disabled = false;
        }, 950);
      },
      { signal: abortController.signal },
    );

    updateOddsUI();
  }

  function destroy() {
    abortController.abort();
    intervals.forEach((intervalId) => window.clearInterval(intervalId));
    intervals.clear();
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeouts.clear();
  }

  return { mount, destroy };
}

window.Casino830Games.createDiceGame = createDiceGame;

function deriveOdds(risk) {
  const chance = Math.max(18, Math.min(85, Number((92 - risk * 0.72).toFixed(2))));
  const multiplier = Number((98 / chance).toFixed(2));
  const label = risk < 35 ? "Low" : risk < 65 ? "Medium" : "High";

  return { chance, multiplier, label };
}
