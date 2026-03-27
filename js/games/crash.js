window.Casino830Games = window.Casino830Games || {};

function createCrashGame({ app }) {
  const abortController = new AbortController();
  let animationFrame = 0;
  let roundActive = false;
  let wager = 0;
  let currentMultiplier = 1;
  let crashPoint = 0;
  let roundStart = 0;

  function mount(container) {
    container.innerHTML = `
      <div class="game-shell">
        <section class="game-panel game-stage">
          <div class="panel-header">
            <div class="panel-title">
              <h3>Crash</h3>
              <p>Cash out before it breaks.</p>
            </div>
            <span class="pill-chip">Timing game</span>
          </div>

          <div class="crash-stage">
            <div class="crash-display">
              <div>
                <div class="crash-multiplier" id="crashMultiplier">1.00x</div>
                <p class="wheel-status" id="crashStatus">Start a round.</p>
              </div>
            </div>

            <div class="crash-track">
              <div class="crash-progress" id="crashProgress"></div>
            </div>

            <div class="crash-grid">
              <article class="selection-card">
                <span>Live Return</span>
                <strong id="crashLivePayout">${app.formatCurrency(0)}</strong>
                <small>Updates live.</small>
              </article>
              <article class="selection-card">
                <span>Last Crash Point</span>
                <strong id="crashPoint">--</strong>
                <small>Shown after the round.</small>
              </article>
            </div>
          </div>
        </section>

        <aside class="game-panel control-panel">
          <div class="panel-title">
            <h3>Round Controls</h3>
            <p>Start or cash out.</p>
          </div>

          <div class="control-stack">
            <label for="crashBet">Bet Amount</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="crashBetDown" aria-label="Lower bet">-</button>
              <input class="number-input" id="crashBet" type="number" min="100" step="100" value="500" />
              <button class="chip-button" type="button" id="crashBetUp" aria-label="Raise bet">+</button>
            </div>
          </div>

          <div class="action-row">
            <button class="primary-action" type="button" id="crashStart">Start</button>
            <button class="secondary-action" type="button" id="crashCashOut" disabled>Cash Out</button>
          </div>

          <div class="metric-card">
            <span>Round Bet</span>
            <strong id="crashWager">${app.formatCurrency(0)}</strong>
            <small>Cash out at the live multiplier.</small>
          </div>

          <div class="status-card">
            <span>Wallet</span>
            <strong id="crashWallet">${app.formatCurrency(app.getBalance())}</strong>
            <small>Shared balance.</small>
          </div>
        </aside>
      </div>
    `;

    const multiplierElement = container.querySelector("#crashMultiplier");
    const statusElement = container.querySelector("#crashStatus");
    const progressElement = container.querySelector("#crashProgress");
    const livePayoutElement = container.querySelector("#crashLivePayout");
    const crashPointElement = container.querySelector("#crashPoint");
    const wagerElement = container.querySelector("#crashWager");
    const walletElement = container.querySelector("#crashWallet");
    const betInput = container.querySelector("#crashBet");
    const startButton = container.querySelector("#crashStart");
    const cashOutButton = container.querySelector("#crashCashOut");

    const syncWallet = () => {
      walletElement.textContent = app.formatCurrency(app.getBalance());
    };

    const render = () => {
      multiplierElement.textContent = app.formatMultiplier(currentMultiplier);
      livePayoutElement.textContent = app.formatCurrency(Math.round(wager * currentMultiplier));
      crashPointElement.textContent = roundActive ? "Hidden" : (crashPoint ? app.formatMultiplier(crashPoint) : "--");
      wagerElement.textContent = app.formatCurrency(wager);
      progressElement.style.width = `${Math.min((Math.log(currentMultiplier) / Math.log(20)) * 100, 100)}%`;
      startButton.disabled = roundActive;
      cashOutButton.disabled = !roundActive;
      multiplierElement.classList.toggle("rising", roundActive);
    };

    const adjustBet = (delta) => {
      const next = app.normalizeBet(Number(betInput.value || 0) + delta, {
        fallback: 500,
        min: 100,
        step: 100,
      });
      betInput.value = String(next);
    };

    const endRound = () => {
      roundActive = false;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      render();
    };

    const tick = (timestamp) => {
      if (!roundActive) {
        return;
      }

      const elapsed = timestamp - roundStart;
      currentMultiplier = Number((1 + elapsed / 1500 + Math.pow(elapsed / 2100, 1.38) * 0.52).toFixed(2));

      if (currentMultiplier >= crashPoint) {
        currentMultiplier = crashPoint;
        statusElement.textContent = `Crashed at ${app.formatMultiplier(crashPoint)}.`;
        app.showToast(`Crash blew up at ${app.formatMultiplier(crashPoint)}.`, "error");
        endRound();
        return;
      }

      render();
      animationFrame = requestAnimationFrame(tick);
    };

    const startRound = () => {
      if (roundActive) {
        return;
      }

      const placedBet = app.takeBet(betInput.value, { fallback: 500, min: 100, step: 100 });
      if (!placedBet) {
        return;
      }

      wager = placedBet;
      currentMultiplier = 1;
      crashPoint = generateCrashPoint();
      roundActive = true;
      roundStart = performance.now();
      statusElement.textContent = "Round live. Cash out before the crash point hits.";
      betInput.value = String(placedBet);
      render();
      animationFrame = requestAnimationFrame(tick);
    };

    const cashOut = () => {
      if (!roundActive) {
        return;
      }

      const payout = Math.round(wager * currentMultiplier);
      app.creditWinnings(payout);
      statusElement.textContent = `Cashed out at ${app.formatMultiplier(currentMultiplier)} for ${app.formatCurrency(payout)}.`;
      app.showToast(`Crash cashed out at ${app.formatMultiplier(currentMultiplier)}.`, "success");
      endRound();
    };

    container.querySelector("#crashBetDown").addEventListener(
      "click",
      () => adjustBet(-100),
      { signal: abortController.signal },
    );
    container.querySelector("#crashBetUp").addEventListener(
      "click",
      () => adjustBet(100),
      { signal: abortController.signal },
    );
    document.addEventListener("casino830:balancechange", syncWallet, { signal: abortController.signal });
    startButton.addEventListener("click", startRound, { signal: abortController.signal });
    cashOutButton.addEventListener("click", cashOut, { signal: abortController.signal });

    syncWallet();
    render();
  }

  function destroy() {
    abortController.abort();
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  }

  return { mount, destroy };
}

window.Casino830Games.createCrashGame = createCrashGame;

// Lower crash points are more common, but the tail still allows occasional long runs.
function generateCrashPoint() {
  const random = Math.random();
  const point = 0.97 / Math.max(0.03, 1 - random);
  return Number(Math.min(20, Math.max(1.05, point)).toFixed(2));
}
