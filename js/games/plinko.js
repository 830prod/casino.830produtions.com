const PLINKO_ROWS = 8;
const PLINKO_MULTIPLIERS = {
  low: [5, 2.4, 1.5, 1.1, 1, 1.1, 1.5, 2.4, 5],
  medium: [9, 4, 2, 1.3, 0.7, 1.3, 2, 4, 9],
  high: [18, 7, 3, 1.4, 0.4, 1.4, 3, 7, 18],
};

window.Casino830Games = window.Casino830Games || {};

function createPlinkoGame({ app }) {
  const abortController = new AbortController();
  const timeouts = new Set();
  let dropping = false;
  let risk = "medium";
  let lastSlot = -1;
  let lastMultiplier = 0;

  function mount(container) {
    container.innerHTML = `
      <div class="game-shell">
        <section class="game-panel game-stage">
          <div class="panel-header">
            <div class="panel-title">
              <h3>Plinko</h3>
              <p>Drop the 830 mark through the board.</p>
            </div>
            <span class="pill-chip">Logo ball</span>
          </div>

          <div class="plinko-stage">
            <div class="plinko-shell">
              <div class="plinko-board" id="plinkoBoard">
                <div class="plinko-pegs">
                  ${renderPlinkoPegs()}
                </div>
                <div class="plinko-ball" id="plinkoBall" aria-hidden="true"></div>
              </div>

              <div class="plinko-slots" id="plinkoSlots"></div>
            </div>

            <div class="game-status" id="plinkoStatus">
              Set a bet and drop the logo.
            </div>

            <div class="selection-grid">
              <article class="selection-card">
                <span>Last Result</span>
                <strong id="plinkoLastResult">--</strong>
                <small id="plinkoLastLabel">Awaiting drop.</small>
              </article>
              <article class="selection-card">
                <span>Best Return</span>
                <strong id="plinkoBestReturn">${app.formatCurrency(4500)}</strong>
                <small id="plinkoBestLabel">Based on the current risk.</small>
              </article>
            </div>
          </div>
        </section>

        <aside class="game-panel control-panel">
          <div class="panel-title">
            <h3>Drop Controls</h3>
            <p>Set bet, choose risk, and drop.</p>
          </div>

          <div class="control-stack">
            <label for="plinkoBet">Bet Amount</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="plinkoBetDown" aria-label="Lower bet">-</button>
              <input class="number-input" id="plinkoBet" type="number" min="100" step="100" value="500" />
              <button class="chip-button" type="button" id="plinkoBetUp" aria-label="Raise bet">+</button>
            </div>
          </div>

          <div class="control-stack">
            <label>Risk</label>
            <div class="chip-row">
              <button class="chip-button" type="button" data-risk="low">Low</button>
              <button class="chip-button selected" type="button" data-risk="medium">Medium</button>
              <button class="chip-button" type="button" data-risk="high">High</button>
            </div>
          </div>

          <div class="action-row">
            <button class="primary-action" type="button" id="plinkoDrop">Drop</button>
          </div>

          <div class="metric-card">
            <span>Risk Profile</span>
            <strong id="plinkoRiskLabel">Medium</strong>
            <small id="plinkoRiskNote">Balanced board.</small>
          </div>

          <div class="status-card">
            <span>Wallet</span>
            <strong id="plinkoWallet">${app.formatCurrency(app.getBalance())}</strong>
            <small>Shared balance.</small>
          </div>
        </aside>
      </div>
    `;

    const boardElement = container.querySelector("#plinkoBoard");
    const ballElement = container.querySelector("#plinkoBall");
    const slotsElement = container.querySelector("#plinkoSlots");
    const statusElement = container.querySelector("#plinkoStatus");
    const lastResultElement = container.querySelector("#plinkoLastResult");
    const lastLabelElement = container.querySelector("#plinkoLastLabel");
    const bestReturnElement = container.querySelector("#plinkoBestReturn");
    const bestLabelElement = container.querySelector("#plinkoBestLabel");
    const riskLabelElement = container.querySelector("#plinkoRiskLabel");
    const riskNoteElement = container.querySelector("#plinkoRiskNote");
    const walletElement = container.querySelector("#plinkoWallet");
    const betInput = container.querySelector("#plinkoBet");
    const dropButton = container.querySelector("#plinkoDrop");

    const queueTimeout = (callback, delay) => {
      const timeoutId = window.setTimeout(() => {
        timeouts.delete(timeoutId);
        callback();
      }, delay);
      timeouts.add(timeoutId);
    };

    const syncWallet = () => {
      walletElement.textContent = app.formatCurrency(app.getBalance());
    };

    const getMetrics = () => {
      const width = boardElement.clientWidth || 420;
      return {
        centerX: width / 2 - 17,
        stepX: width / 18,
        startY: 4,
        stepY: 34,
        settleY: 292,
      };
    };

    const placeBall = (step, rights) => {
      const metrics = getMetrics();
      const x = metrics.centerX + (2 * rights - step) * metrics.stepX;
      const y = metrics.startY + step * metrics.stepY;
      ballElement.style.transform = `translate(${x}px, ${y}px)`;
    };

    const settleBall = (slotIndex) => {
      const metrics = getMetrics();
      const x = metrics.centerX + (2 * slotIndex - PLINKO_ROWS) * metrics.stepX;
      ballElement.style.transform = `translate(${x}px, ${metrics.settleY}px)`;
    };

    const renderSlots = () => {
      const multipliers = PLINKO_MULTIPLIERS[risk];
      slotsElement.innerHTML = multipliers
        .map((multiplier, index) => {
          const hitClass = index === lastSlot ? " is-hit" : "";
          return `
            <div class="plinko-slot${hitClass}" data-band="${getPlinkoBand(multiplier)}">
              <span>${app.formatMultiplier(multiplier)}</span>
            </div>
          `;
        })
        .join("");
    };

    const updateUi = () => {
      const previewBet = app.normalizeBet(betInput.value, { fallback: 500, min: 100, step: 100 });
      const multipliers = PLINKO_MULTIPLIERS[risk];
      const topMultiplier = Math.max.apply(null, multipliers);
      const riskCopy = getPlinkoRiskCopy(risk);

      renderSlots();
      bestReturnElement.textContent = app.formatCurrency(Math.round(previewBet * topMultiplier));
      bestLabelElement.textContent = `Up to ${app.formatMultiplier(topMultiplier)} on ${risk}.`;
      riskLabelElement.textContent = riskCopy.label;
      riskNoteElement.textContent = riskCopy.note;

      if (lastSlot === -1) {
        lastResultElement.textContent = "--";
        lastLabelElement.textContent = "Awaiting drop.";
      } else {
        lastResultElement.textContent = app.formatMultiplier(lastMultiplier);
        lastLabelElement.textContent = `Slot ${lastSlot + 1} landed.`;
      }

      container.querySelectorAll("[data-risk]").forEach((button) => {
        button.classList.toggle("selected", button.dataset.risk === risk);
      });
      syncWallet();
    };

    const adjustBet = (delta) => {
      const next = app.normalizeBet(Number(betInput.value || 0) + delta, {
        fallback: 500,
        min: 100,
        step: 100,
      });
      betInput.value = String(next);
      updateUi();
    };

    const finishDrop = (slotIndex, wager) => {
      const multiplier = PLINKO_MULTIPLIERS[risk][slotIndex];
      const payout = Math.round(wager * multiplier);
      lastSlot = slotIndex;
      lastMultiplier = multiplier;

      if (payout > 0) {
        app.creditWinnings(payout);
      }

      if (multiplier >= 1.5) {
        statusElement.textContent = `${app.formatMultiplier(multiplier)} landed. ${app.formatCurrency(payout)} returned.`;
        app.showToast(`Plinko hit ${app.formatMultiplier(multiplier)}.`, "success");
      } else if (multiplier >= 1) {
        statusElement.textContent = `${app.formatMultiplier(multiplier)} landed. ${app.formatCurrency(payout)} returned.`;
        app.showToast(`Plinko settled at ${app.formatMultiplier(multiplier)}.`, "info");
      } else {
        statusElement.textContent = `${app.formatMultiplier(multiplier)} landed. ${app.formatCurrency(payout)} returned.`;
        app.showToast(`Plinko missed the edge.`, "error");
      }

      ballElement.classList.remove("is-dropping");
      dropping = false;
      dropButton.disabled = false;
      updateUi();
    };

    const dropBall = () => {
      if (dropping) {
        return;
      }

      const wager = app.takeBet(betInput.value, { fallback: 500, min: 100, step: 100 });
      if (!wager) {
        return;
      }

      const path = Array.from({ length: PLINKO_ROWS }, () => Math.random() >= 0.5);
      let rights = 0;

      lastSlot = -1;
      lastMultiplier = 0;
      dropping = true;
      dropButton.disabled = true;
      betInput.value = String(wager);
      statusElement.textContent = "Ball in play.";
      ballElement.classList.add("is-dropping");
      updateUi();
      placeBall(0, 0);

      path.forEach((moveRight, index) => {
        queueTimeout(() => {
          if (moveRight) {
            rights += 1;
          }
          placeBall(index + 1, rights);
        }, (index + 1) * 150);
      });

      queueTimeout(() => {
        settleBall(rights);
      }, (PLINKO_ROWS + 1) * 150);

      queueTimeout(() => {
        finishDrop(rights, wager);
      }, (PLINKO_ROWS + 1) * 150 + 220);
    };

    container.querySelector("#plinkoBetDown").addEventListener(
      "click",
      () => adjustBet(-100),
      { signal: abortController.signal },
    );
    container.querySelector("#plinkoBetUp").addEventListener(
      "click",
      () => adjustBet(100),
      { signal: abortController.signal },
    );
    container.querySelectorAll("[data-risk]").forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          if (dropping) {
            return;
          }

          risk = button.dataset.risk;
          lastSlot = -1;
          lastMultiplier = 0;
          updateUi();
        },
        { signal: abortController.signal },
      );
    });
    betInput.addEventListener("input", updateUi, { signal: abortController.signal });
    dropButton.addEventListener("click", dropBall, { signal: abortController.signal });
    document.addEventListener("casino830:balancechange", syncWallet, { signal: abortController.signal });
    window.addEventListener(
      "resize",
      () => {
        if (!dropping) {
          placeBall(0, 0);
        }
      },
      { signal: abortController.signal },
    );

    updateUi();
    queueTimeout(() => {
      placeBall(0, 0);
    }, 0);
  }

  function destroy() {
    abortController.abort();
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeouts.clear();
  }

  return { mount, destroy };
}

window.Casino830Games.createPlinkoGame = createPlinkoGame;

function renderPlinkoPegs() {
  const pegs = [];

  for (let row = 0; row < PLINKO_ROWS; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      const left = 50 + (column - row / 2) * 10.8;
      const top = 32 + row * 34;
      pegs.push(
        `<span class="plinko-peg" style="left:${left}%; top:${top}px;" aria-hidden="true"></span>`,
      );
    }
  }

  return pegs.join("");
}

function getPlinkoBand(multiplier) {
  if (multiplier >= 7) {
    return "hot";
  }
  if (multiplier >= 2) {
    return "warm";
  }
  if (multiplier >= 1) {
    return "safe";
  }
  return "cold";
}

function getPlinkoRiskCopy(risk) {
  if (risk === "low") {
    return { label: "Low", note: "Softer curve." };
  }
  if (risk === "high") {
    return { label: "High", note: "Big edges, thin center." };
  }
  return { label: "Medium", note: "Balanced board." };
}
