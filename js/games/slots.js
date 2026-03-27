const SYMBOLS = [
  { id: "seven", mark: "7", name: "Lucky 7", jackpot: 12 },
  { id: "crown", mark: "Q", name: "Crown", jackpot: 8 },
  { id: "star", mark: "★", name: "Star", jackpot: 6 },
  { id: "bar", mark: "BAR", name: "Bar", jackpot: 5 },
  { id: "cherry", mark: "CH", name: "Cherry", jackpot: 4 },
];

window.Casino830Games = window.Casino830Games || {};

function createSlotsGame({ app }) {
  const abortController = new AbortController();
  const timeouts = new Set();
  const intervals = new Set();

  function mount(container) {
    const initialReels = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];

    container.innerHTML = `
      <div class="game-shell">
        <section class="game-panel game-stage">
          <div class="panel-header">
            <div class="panel-title">
              <h3>Slots</h3>
              <p>Three reels. Quick outcomes.</p>
            </div>
            <span class="pill-chip">Rapid reels</span>
          </div>

          <div class="slots-stage">
            <div class="reels">
              ${initialReels
                .map(
                  (symbol, index) => `
                    <div class="reel-window">
                      <div class="reel" data-reel-index="${index}">
                        ${renderSymbol(symbol)}
                      </div>
                    </div>
                  `,
                )
                .join("")}
            </div>

            <div class="game-status" id="slotsStatus">
              Match symbols to win.
            </div>

            <div class="selection-grid">
              <article class="selection-card">
                <span>Spin Rhythm</span>
                <strong>3 reels</strong>
                <small>Fast play.</small>
              </article>
              <article class="selection-card">
                <span>Top Return</span>
                <strong>12.00x</strong>
                <small>Lucky 7 x3.</small>
              </article>
            </div>
          </div>
        </section>

        <aside class="game-panel control-panel">
          <div class="panel-title">
            <h3>Spin Controls</h3>
            <p>Set bet and spin.</p>
          </div>

          <div class="control-stack">
            <label for="slotsBet">Bet Amount</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="slotsBetDown" aria-label="Lower bet">-</button>
              <input class="number-input" id="slotsBet" type="number" min="100" step="100" value="500" />
              <button class="chip-button" type="button" id="slotsBetUp" aria-label="Raise bet">+</button>
            </div>
          </div>

          <div class="action-row">
            <button class="primary-action" type="button" id="slotsSpin">Spin</button>
          </div>

          <div class="status-card">
            <span>Current Wallet</span>
            <strong id="slotsWallet">${app.formatCurrency(app.getBalance())}</strong>
            <small>Updates after every spin.</small>
          </div>

          <div class="metric-card">
            <span>Returns</span>
            <ul class="meta-list">
              <li><strong>Lucky 7 x3</strong> returns 12.00x</li>
              <li><strong>Crown x3</strong> returns 8.00x</li>
              <li><strong>Any pair</strong> returns 1.60x to 2.40x</li>
            </ul>
          </div>
        </aside>
      </div>
    `;

    const reelElements = Array.from(container.querySelectorAll(".reel"));
    const betInput = container.querySelector("#slotsBet");
    const spinButton = container.querySelector("#slotsSpin");
    const statusElement = container.querySelector("#slotsStatus");
    const walletElement = container.querySelector("#slotsWallet");
    let spinning = false;

    const syncWallet = () => {
      walletElement.textContent = app.formatCurrency(app.getBalance());
    };

    const adjustBet = (delta) => {
      const next = app.normalizeBet(Number(betInput.value || 0) + delta, {
        fallback: 500,
        min: 100,
        step: 100,
      });
      betInput.value = String(next);
    };

    container.querySelector("#slotsBetDown").addEventListener(
      "click",
      () => adjustBet(-100),
      { signal: abortController.signal },
    );
    container.querySelector("#slotsBetUp").addEventListener(
      "click",
      () => adjustBet(100),
      { signal: abortController.signal },
    );
    document.addEventListener("casino830:balancechange", syncWallet, { signal: abortController.signal });

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
        spinning = true;
        spinButton.disabled = true;
        statusElement.textContent = `Spinning ${app.formatCurrency(wager)} across the reels...`;

        const finalSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];

        reelElements.forEach((reel, index) => {
          reel.classList.add("spinning");
          const intervalId = window.setInterval(() => {
            reel.innerHTML = renderSymbol(getRandomSymbol());
          }, 80 + index * 10);
          intervals.add(intervalId);

          queueTimeout(() => {
            window.clearInterval(intervalId);
            intervals.delete(intervalId);
            reel.innerHTML = renderSymbol(finalSymbols[index]);
            reel.classList.remove("spinning");
          }, 900 + index * 180);
        });

        queueTimeout(() => {
          const outcome = evaluateSpin(finalSymbols);

          if (outcome.multiplier > 0) {
            const payout = Math.round(wager * outcome.multiplier);
            app.creditWinnings(payout);
            app.showToast(`${outcome.message} ${app.formatCurrency(payout)} returned.`, "success");
            statusElement.textContent = `${outcome.message} Paid ${app.formatCurrency(payout)} at ${app.formatMultiplier(outcome.multiplier)}.`;
          } else {
            app.showToast("Slots missed this round.", "error");
            statusElement.textContent = "No match. Spin again.";
          }

          spinning = false;
          spinButton.disabled = false;
        }, 1500);
      },
      { signal: abortController.signal },
    );

    syncWallet();
  }

  function destroy() {
    abortController.abort();
    intervals.forEach((intervalId) => window.clearInterval(intervalId));
    intervals.clear();
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeouts.clear();
  }

  function queueTimeout(callback, delay) {
    const timeoutId = window.setTimeout(() => {
      timeouts.delete(timeoutId);
      callback();
    }, delay);
    timeouts.add(timeoutId);
  }

  return { mount, destroy };
}

window.Casino830Games.createSlotsGame = createSlotsGame;

function renderSymbol(symbol) {
  return `
    <div class="slot-symbol">
      <span class="slot-symbol-mark">${symbol.mark}</span>
      <span class="slot-symbol-name">${symbol.name}</span>
    </div>
  `;
}

function getRandomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function evaluateSpin(symbols) {
  const counts = symbols.reduce((accumulator, symbol) => {
    accumulator[symbol.id] = (accumulator[symbol.id] || 0) + 1;
    return accumulator;
  }, {});

  const topEntry = Object.entries(counts).sort((left, right) => right[1] - left[1])[0];
  const matchedSymbol = SYMBOLS.find((symbol) => symbol.id === topEntry[0]);

  if (topEntry[1] === 3) {
    return {
      multiplier: matchedSymbol.jackpot,
      message: `Triple ${matchedSymbol.name}!`,
    };
  }

  if (topEntry[1] === 2) {
    const pairMap = {
      seven: 2.4,
      crown: 2.1,
      star: 1.9,
      bar: 1.7,
      cherry: 1.6,
    };

    return {
      multiplier: pairMap[matchedSymbol.id] || 1.6,
      message: `${matchedSymbol.name} pair connected.`,
    };
  }

  return { multiplier: 0, message: "No win" };
}
