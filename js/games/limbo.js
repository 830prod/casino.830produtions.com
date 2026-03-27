window.Casino830Games = window.Casino830Games || {};

function createLimboGame({ app }) {
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
              <h3>Limbo</h3>
              <p>Beat your target multiplier.</p>
            </div>
            <span class="pill-chip">Target game</span>
          </div>

          <div class="limbo-stage">
            <div class="limbo-display">
              <div>
                <div class="limbo-result" id="limboResult">--.--x</div>
                <p class="wheel-status" id="limboStatus">Set a target and roll.</p>
              </div>
            </div>

            <div class="selection-grid">
              <article class="selection-card">
                <span>Target</span>
                <strong id="limboTargetPreview">2.00x</strong>
                <small id="limboChance">Roll at or above the target.</small>
              </article>
              <article class="selection-card">
                <span>Potential Return</span>
                <strong id="limboPotential">${app.formatCurrency(1000)}</strong>
                <small id="limboPayoutLabel">Based on the current target.</small>
              </article>
            </div>
          </div>
        </section>

        <aside class="game-panel control-panel">
          <div class="panel-title">
            <h3>Roll Controls</h3>
            <p>Set bet and target, then roll once.</p>
          </div>

          <div class="control-stack">
            <label for="limboBet">Bet Amount</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="limboBetDown" aria-label="Lower bet">-</button>
              <input class="number-input" id="limboBet" type="number" min="100" step="100" value="500" />
              <button class="chip-button" type="button" id="limboBetUp" aria-label="Raise bet">+</button>
            </div>
          </div>

          <div class="control-stack">
            <label for="limboTarget">Target Multiplier</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="limboTargetDown" aria-label="Lower target">-</button>
              <input class="number-input" id="limboTarget" type="number" min="1.1" max="20" step="0.1" value="2.0" />
              <button class="chip-button" type="button" id="limboTargetUp" aria-label="Raise target">+</button>
            </div>
          </div>

          <div class="action-row">
            <button class="primary-action" type="button" id="limboRoll">Roll</button>
          </div>

          <div class="metric-card">
            <span>Live Target</span>
            <strong id="limboTargetMetric">2.00x</strong>
            <small id="limboMetricLabel">Higher targets win less often.</small>
          </div>

          <div class="status-card">
            <span>Wallet</span>
            <strong id="limboWallet">${app.formatCurrency(app.getBalance())}</strong>
            <small>Shared demo balance.</small>
          </div>
        </aside>
      </div>
    `;

    const resultElement = container.querySelector("#limboResult");
    const statusElement = container.querySelector("#limboStatus");
    const targetPreviewElement = container.querySelector("#limboTargetPreview");
    const chanceElement = container.querySelector("#limboChance");
    const potentialElement = container.querySelector("#limboPotential");
    const payoutLabelElement = container.querySelector("#limboPayoutLabel");
    const targetMetricElement = container.querySelector("#limboTargetMetric");
    const metricLabelElement = container.querySelector("#limboMetricLabel");
    const walletElement = container.querySelector("#limboWallet");
    const betInput = container.querySelector("#limboBet");
    const targetInput = container.querySelector("#limboTarget");
    const rollButton = container.querySelector("#limboRoll");

    const syncWallet = () => {
      walletElement.textContent = app.formatCurrency(app.getBalance());
    };

    const updatePreview = () => {
      const target = normalizeTarget(targetInput.value);
      const wager = app.normalizeBet(betInput.value, { fallback: 500, min: 100, step: 100 });
      const winChance = Number((99 / target).toFixed(2));

      targetInput.value = target.toFixed(2);
      targetPreviewElement.textContent = app.formatMultiplier(target);
      chanceElement.textContent = `${winChance.toFixed(2)}% win chance.`;
      potentialElement.textContent = app.formatCurrency(Math.round(wager * target));
      payoutLabelElement.textContent = `Pays ${app.formatMultiplier(target)} on win.`;
      targetMetricElement.textContent = app.formatMultiplier(target);
      metricLabelElement.textContent = winChance >= 25 ? "Balanced target." : "Higher risk target.";
    };

    const adjustBet = (delta) => {
      const next = app.normalizeBet(Number(betInput.value || 0) + delta, {
        fallback: 500,
        min: 100,
        step: 100,
      });
      betInput.value = String(next);
      updatePreview();
    };

    const adjustTarget = (delta) => {
      const next = normalizeTarget(Number(targetInput.value || 0) + delta);
      targetInput.value = next.toFixed(2);
      updatePreview();
    };

    const queueTimeout = (callback, delay) => {
      const timeoutId = window.setTimeout(() => {
        timeouts.delete(timeoutId);
        callback();
      }, delay);
      timeouts.add(timeoutId);
    };

    const settleRoll = (wager, target) => {
      const result = generateLimboResult();
      const won = result >= target;
      resultElement.classList.remove("rolling");
      resultElement.textContent = app.formatMultiplier(result);

      if (won) {
        const payout = Math.round(wager * target);
        app.creditWinnings(payout);
        statusElement.textContent = `${app.formatMultiplier(result)} cleared ${app.formatMultiplier(target)}. ${app.formatCurrency(payout)} returned.`;
        app.showToast(`Limbo hit ${app.formatMultiplier(result)}.`, "success");
      } else {
        statusElement.textContent = `${app.formatMultiplier(result)} missed ${app.formatMultiplier(target)}.`;
        app.showToast(`Limbo missed at ${app.formatMultiplier(result)}.`, "error");
      }

      rolling = false;
      rollButton.disabled = false;
    };

    container.querySelector("#limboBetDown").addEventListener(
      "click",
      () => adjustBet(-100),
      { signal: abortController.signal },
    );
    container.querySelector("#limboBetUp").addEventListener(
      "click",
      () => adjustBet(100),
      { signal: abortController.signal },
    );
    container.querySelector("#limboTargetDown").addEventListener(
      "click",
      () => adjustTarget(-0.1),
      { signal: abortController.signal },
    );
    container.querySelector("#limboTargetUp").addEventListener(
      "click",
      () => adjustTarget(0.1),
      { signal: abortController.signal },
    );
    targetInput.addEventListener("input", updatePreview, { signal: abortController.signal });
    betInput.addEventListener("input", updatePreview, { signal: abortController.signal });
    document.addEventListener("casino830:balancechange", syncWallet, { signal: abortController.signal });

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

        const target = normalizeTarget(targetInput.value);
        rolling = true;
        rollButton.disabled = true;
        resultElement.classList.add("rolling");
        statusElement.textContent = `Rolling for ${app.formatMultiplier(target)}...`;
        betInput.value = String(wager);
        targetInput.value = target.toFixed(2);
        updatePreview();

        const intervalId = window.setInterval(() => {
          resultElement.textContent = app.formatMultiplier(generateLimboResult());
        }, 90);
        intervals.add(intervalId);

        queueTimeout(() => {
          window.clearInterval(intervalId);
          intervals.delete(intervalId);
          settleRoll(wager, target);
        }, 1200);
      },
      { signal: abortController.signal },
    );

    syncWallet();
    updatePreview();
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

window.Casino830Games.createLimboGame = createLimboGame;

function normalizeTarget(value) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : 2;
  return Math.max(1.1, Math.min(20, Number((Math.round(safe * 100) / 100).toFixed(2))));
}

function generateLimboResult() {
  const random = Math.random();
  const result = 0.99 / Math.max(0.01, 1 - random);
  return Number(Math.min(100, Math.max(1, result)).toFixed(2));
}
