window.Casino830Games = window.Casino830Games || {};

function createMinesGame({ app }) {
  const abortController = new AbortController();
  const totalTiles = 25;
  let board = [];
  let currentBet = 0;
  let safePicks = 0;
  let mineCount = 3;
  let currentMultiplier = 1;
  let roundActive = false;
  let roundOver = false;

  function mount(container) {
    container.innerHTML = `
      <div class="game-shell">
        <section class="game-panel game-stage">
          <div class="panel-header">
            <div class="panel-title">
              <h3>Mines</h3>
              <p>White marks are safe. Dark marks end the round.</p>
            </div>
            <span class="pill-chip">Grid game</span>
          </div>

          <div class="mines-stage">
            <div class="mines-board" id="minesBoard"></div>

            <div class="game-status" id="minesStatus">
              Start a round, then pick a tile.
            </div>

            <div class="selection-grid">
              <article class="selection-card">
                <span>Safe Picks</span>
                <strong id="minesPicks">0 / 22</strong>
                <small>More picks raise the multiplier.</small>
              </article>
              <article class="selection-card">
                <span>Live Return</span>
                <strong id="minesLivePayout">${app.formatCurrency(0)}</strong>
                <small id="minesLiveLabel">Cash out after a safe pick.</small>
              </article>
            </div>
          </div>
        </section>

        <aside class="game-panel control-panel">
          <div class="panel-title">
            <h3>Round Controls</h3>
            <p>Set bet, choose mines, and pick carefully.</p>
          </div>

          <div class="control-stack">
            <label for="minesBet">Bet Amount</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="minesBetDown" aria-label="Lower bet">-</button>
              <input class="number-input" id="minesBet" type="number" min="100" step="100" value="500" />
              <button class="chip-button" type="button" id="minesBetUp" aria-label="Raise bet">+</button>
            </div>
          </div>

          <div class="control-stack">
            <label for="minesCount">Mine Count</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="minesCountDown" aria-label="Lower mine count">-</button>
              <input class="number-input" id="minesCount" type="number" min="1" max="12" step="1" value="3" />
              <button class="chip-button" type="button" id="minesCountUp" aria-label="Raise mine count">+</button>
            </div>
          </div>

          <div class="action-row">
            <button class="primary-action" type="button" id="minesStart">Start</button>
            <button class="secondary-action" type="button" id="minesCashOut" disabled>Cash Out</button>
          </div>

          <div class="metric-card">
            <span>Live Multiplier</span>
            <strong id="minesMultiplier">${app.formatMultiplier(1)}</strong>
            <small id="minesOdds">3 mines on the board.</small>
          </div>

          <div class="status-card">
            <span>Wallet</span>
            <strong id="minesWallet">${app.formatCurrency(app.getBalance())}</strong>
            <small id="minesBetValue">Current bet ${app.formatCurrency(0)}.</small>
          </div>
        </aside>
      </div>
    `;

    const boardElement = container.querySelector("#minesBoard");
    const statusElement = container.querySelector("#minesStatus");
    const picksElement = container.querySelector("#minesPicks");
    const livePayoutElement = container.querySelector("#minesLivePayout");
    const liveLabelElement = container.querySelector("#minesLiveLabel");
    const multiplierElement = container.querySelector("#minesMultiplier");
    const oddsElement = container.querySelector("#minesOdds");
    const walletElement = container.querySelector("#minesWallet");
    const betValueElement = container.querySelector("#minesBetValue");
    const betInput = container.querySelector("#minesBet");
    const mineInput = container.querySelector("#minesCount");
    const startButton = container.querySelector("#minesStart");
    const cashOutButton = container.querySelector("#minesCashOut");

    const syncWallet = () => {
      walletElement.textContent = app.formatCurrency(app.getBalance());
    };

    const renderBoard = () => {
      boardElement.innerHTML = Array.from({ length: totalTiles }, (_, index) => {
        const tile = board[index];
        const revealed = Boolean(tile && (tile.revealed || roundOver));
        const disabled = !roundActive || !tile || tile.revealed;
        let stateClass = "";
        let content = '<span class="mines-cell-shell" aria-hidden="true"></span>';

        if (revealed && tile) {
          if (tile.hasMine) {
            stateClass = " revealed-mine";
            content = '<span class="mines-cell-logo mines-logo-mine" aria-hidden="true"></span>';
          } else {
            stateClass = " revealed-safe";
            content = '<span class="mines-cell-logo mines-logo-gem" aria-hidden="true"></span>';
          }
        }

        return `
          <button
            class="mines-cell${stateClass}"
            type="button"
            data-index="${index}"
            ${disabled ? "disabled" : ""}
            aria-label="Reveal tile ${index + 1}"
          >
            ${content}
          </button>
        `;
      }).join("");
    };

    const render = () => {
      const safeTotal = totalTiles - mineCount;
      const livePayout = safePicks > 0 ? Math.round(currentBet * currentMultiplier) : 0;

      mineCount = normalizeMineCount(mineInput.value);
      mineInput.value = String(mineCount);
      picksElement.textContent = `${safePicks} / ${safeTotal}`;
      livePayoutElement.textContent = app.formatCurrency(livePayout);
      liveLabelElement.textContent = safePicks
        ? `Cash out at ${app.formatMultiplier(currentMultiplier)}.`
        : "Cash out after a safe pick.";
      multiplierElement.textContent = app.formatMultiplier(currentMultiplier);
      oddsElement.textContent = `${mineCount} ${mineCount === 1 ? "mine" : "mines"} on the board.`;
      betValueElement.textContent = `Current bet ${app.formatCurrency(currentBet)}.`;
      syncWallet();
      renderBoard();

      startButton.disabled = roundActive;
      cashOutButton.disabled = !roundActive || safePicks === 0;
      mineInput.disabled = roundActive;
      container.querySelector("#minesCountDown").disabled = roundActive;
      container.querySelector("#minesCountUp").disabled = roundActive;
    };

    const adjustBet = (delta) => {
      const next = app.normalizeBet(Number(betInput.value || 0) + delta, {
        fallback: 500,
        min: 100,
        step: 100,
      });
      betInput.value = String(next);
    };

    const adjustMineCount = (delta) => {
      const current = normalizeMineCount(mineInput.value);
      mineInput.value = String(normalizeMineCount(current + delta));
      render();
    };

    const revealAll = () => {
      board = board.map((tile) => ({
        index: tile.index,
        hasMine: tile.hasMine,
        revealed: true,
      }));
    };

    const finishRound = (message, variant) => {
      roundActive = false;
      roundOver = true;
      revealAll();
      statusElement.textContent = message;
      render();
      app.showToast(message, variant || "info");
    };

    const startRound = () => {
      if (roundActive) {
        return;
      }

      const placedBet = app.takeBet(betInput.value, { fallback: 500, min: 100, step: 100 });
      if (!placedBet) {
        return;
      }

      mineCount = normalizeMineCount(mineInput.value);
      currentBet = placedBet;
      safePicks = 0;
      currentMultiplier = 1;
      roundActive = true;
      roundOver = false;
      board = createBoard(mineCount, totalTiles);
      betInput.value = String(placedBet);
      statusElement.textContent = "Pick a tile.";
      render();
    };

    const cashOut = () => {
      if (!roundActive || safePicks === 0) {
        return;
      }

      const payout = Math.round(currentBet * currentMultiplier);
      app.creditWinnings(payout);
      finishRound(`Cashed out for ${app.formatCurrency(payout)}.`, "success");
    };

    const revealTile = (index) => {
      if (!roundActive || !board[index] || board[index].revealed) {
        return;
      }

      board[index].revealed = true;

      if (board[index].hasMine) {
        finishRound("Mine hit. Round lost.", "error");
        return;
      }

      safePicks += 1;
      currentMultiplier = calculateMinesMultiplier(mineCount, safePicks, totalTiles);

      if (safePicks === totalTiles - mineCount) {
        const payout = Math.round(currentBet * currentMultiplier);
        app.creditWinnings(payout);
        finishRound(`Board cleared for ${app.formatCurrency(payout)}.`, "success");
        return;
      }

      statusElement.textContent = `${safePicks} safe ${safePicks === 1 ? "pick" : "picks"}. Keep going or cash out.`;
      render();
    };

    container.querySelector("#minesBetDown").addEventListener(
      "click",
      () => adjustBet(-100),
      { signal: abortController.signal },
    );
    container.querySelector("#minesBetUp").addEventListener(
      "click",
      () => adjustBet(100),
      { signal: abortController.signal },
    );
    container.querySelector("#minesCountDown").addEventListener(
      "click",
      () => adjustMineCount(-1),
      { signal: abortController.signal },
    );
    container.querySelector("#minesCountUp").addEventListener(
      "click",
      () => adjustMineCount(1),
      { signal: abortController.signal },
    );
    mineInput.addEventListener("input", render, { signal: abortController.signal });
    document.addEventListener("casino830:balancechange", syncWallet, { signal: abortController.signal });
    startButton.addEventListener("click", startRound, { signal: abortController.signal });
    cashOutButton.addEventListener("click", cashOut, { signal: abortController.signal });
    boardElement.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("[data-index]");
        if (!button) {
          return;
        }

        revealTile(Number(button.dataset.index));
      },
      { signal: abortController.signal },
    );

    board = createBoard(0, totalTiles);
    render();
  }

  function destroy() {
    abortController.abort();
  }

  return { mount, destroy };
}

window.Casino830Games.createMinesGame = createMinesGame;

function normalizeMineCount(value) {
  return Math.max(1, Math.min(12, Math.round(Number(value) || 3)));
}

function createBoard(mineCount, totalTiles) {
  const safeMineCount = Math.min(Math.max(0, mineCount), Math.max(0, totalTiles - 1));
  const mineIndexes = new Set();

  while (mineIndexes.size < safeMineCount) {
    mineIndexes.add(Math.floor(Math.random() * totalTiles));
  }

  return Array.from({ length: totalTiles }, (_, index) => ({
    index,
    hasMine: mineIndexes.has(index),
    revealed: false,
  }));
}

function calculateMinesMultiplier(mineCount, safePicks, totalTiles) {
  if (safePicks <= 0) {
    return 1;
  }

  let multiplier = 1;

  for (let step = 0; step < safePicks; step += 1) {
    multiplier *= (totalTiles - step) / (totalTiles - mineCount - step);
  }

  return Number((multiplier * 0.99).toFixed(2));
}
