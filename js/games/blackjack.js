const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

window.Casino830Games = window.Casino830Games || {};

function createBlackjackGame({ app }) {
  const abortController = new AbortController();
  let playerHand = [];
  let dealerHand = [];
  let currentBet = 0;
  let roundActive = false;
  let roundOver = false;
  let statusMessage = "Set a bet and deal.";

  function mount(container) {
    container.innerHTML = `
      <div class="game-shell">
        <section class="game-panel game-stage">
          <div class="panel-header">
            <div class="panel-title">
              <h3>Blackjack</h3>
              <p>Player vs dealer.</p>
            </div>
            <span class="pill-chip">Classic table</span>
          </div>

          <div class="table-felt">
            <div class="panel-subheader">
              <div class="selection-grid">
                <article class="selection-card">
                  <span>Dealer Total</span>
                  <strong id="blackjackDealerTotal">0</strong>
                  <small>Shown after reveal.</small>
                </article>
                <article class="selection-card">
                  <span>Your Total</span>
                  <strong id="blackjackPlayerTotal">0</strong>
                  <small>Aces adjust automatically.</small>
                </article>
              </div>
            </div>

            <div class="hands-grid">
              <section class="hand-group">
                <div class="hand-header">
                  <h4>Dealer</h4>
                  <span class="pill-chip" id="blackjackDealerState">Waiting</span>
                </div>
                <div class="card-row" id="blackjackDealerHand"></div>
              </section>

              <section class="hand-group">
                <div class="hand-header">
                  <h4>Player</h4>
                  <span class="pill-chip" id="blackjackPlayerState">Ready</span>
                </div>
                <div class="card-row" id="blackjackPlayerHand"></div>
              </section>
            </div>

            <div class="game-status" id="blackjackStatus">${statusMessage}</div>
          </div>
        </section>

        <aside class="game-panel control-panel">
          <div class="panel-title">
            <h3>Table Controls</h3>
            <p>Deal, hit, or stand.</p>
          </div>

          <div class="control-stack">
            <label for="blackjackBet">Bet Amount</label>
            <div class="stepper-row">
              <button class="chip-button" type="button" id="blackjackBetDown" aria-label="Lower bet">-</button>
              <input class="number-input" id="blackjackBet" type="number" min="100" step="100" value="500" />
              <button class="chip-button" type="button" id="blackjackBetUp" aria-label="Raise bet">+</button>
            </div>
          </div>

          <div class="action-row">
            <button class="primary-action" type="button" id="blackjackDeal">Deal</button>
            <button class="secondary-action" type="button" id="blackjackHit">Hit</button>
            <button class="secondary-action" type="button" id="blackjackStand">Stand</button>
          </div>

          <div class="metric-card">
            <span>Round Wager</span>
            <strong id="blackjackCurrentBet">${app.formatCurrency(0)}</strong>
            <small>Blackjack 2.50x. Win 2.00x. Push refunds.</small>
          </div>

          <div class="status-card">
            <span>Wallet</span>
            <strong id="blackjackWallet">${app.formatCurrency(app.getBalance())}</strong>
            <small>Shared balance.</small>
          </div>
        </aside>
      </div>
    `;

    const dealerHandElement = container.querySelector("#blackjackDealerHand");
    const playerHandElement = container.querySelector("#blackjackPlayerHand");
    const dealerTotalElement = container.querySelector("#blackjackDealerTotal");
    const playerTotalElement = container.querySelector("#blackjackPlayerTotal");
    const dealerStateElement = container.querySelector("#blackjackDealerState");
    const playerStateElement = container.querySelector("#blackjackPlayerState");
    const statusElement = container.querySelector("#blackjackStatus");
    const currentBetElement = container.querySelector("#blackjackCurrentBet");
    const walletElement = container.querySelector("#blackjackWallet");
    const betInput = container.querySelector("#blackjackBet");
    const dealButton = container.querySelector("#blackjackDeal");
    const hitButton = container.querySelector("#blackjackHit");
    const standButton = container.querySelector("#blackjackStand");

    const syncWallet = () => {
      walletElement.textContent = app.formatCurrency(app.getBalance());
    };

    const render = () => {
      const revealDealer = roundOver;
      const playerTotal = getHandValue(playerHand);
      const dealerTotal = revealDealer ? getHandValue(dealerHand) : getHandValue([dealerHand[0]].filter(Boolean));

      dealerHandElement.innerHTML = dealerHand
        .map((card, index) => renderCard(card, !revealDealer && index === 1))
        .join("");
      playerHandElement.innerHTML = playerHand.map((card) => renderCard(card)).join("");

      dealerTotalElement.textContent = dealerHand.length ? String(dealerTotal) : "0";
      playerTotalElement.textContent = playerHand.length ? String(playerTotal) : "0";
      dealerStateElement.textContent = roundOver ? "Revealed" : roundActive ? "Showing 1 card" : "Waiting";
      playerStateElement.textContent = roundActive && !roundOver ? "Live hand" : roundOver ? "Settled" : "Ready";
      statusElement.textContent = statusMessage;
      currentBetElement.textContent = app.formatCurrency(currentBet);
      dealButton.disabled = roundActive && !roundOver;
      hitButton.disabled = !roundActive || roundOver;
      standButton.disabled = !roundActive || roundOver;
    };

    const adjustBet = (delta) => {
      const next = app.normalizeBet(Number(betInput.value || 0) + delta, {
        fallback: 500,
        min: 100,
        step: 100,
      });
      betInput.value = String(next);
    };

    const finishRound = (message, variant = "info") => {
      roundActive = false;
      roundOver = true;
      statusMessage = message;
      render();
      app.showToast(message, variant);
    };

    const deal = () => {
      if (roundActive && !roundOver) {
        return;
      }

      const wager = app.takeBet(betInput.value, { fallback: 500, min: 100, step: 100 });
      if (!wager) {
        return;
      }

      currentBet = wager;
      betInput.value = String(wager);
      playerHand = [drawCard(), drawCard()];
      dealerHand = [drawCard(), drawCard()];
      roundActive = true;
      roundOver = false;
      statusMessage = "Your move.";
      render();

      const playerTotal = getHandValue(playerHand);
      const dealerTotal = getHandValue(dealerHand);

      if (playerTotal === 21 && dealerTotal === 21) {
        app.refund(currentBet);
        finishRound("Both sides opened with blackjack. Push refunded.", "info");
      } else if (playerTotal === 21) {
        const payout = Math.round(currentBet * 2.5);
        app.creditWinnings(payout);
        finishRound(`Blackjack! ${app.formatCurrency(payout)} returned.`, "success");
      } else if (dealerTotal === 21) {
        finishRound("Dealer opened with blackjack. Hand lost.", "error");
      }
    };

    const hit = () => {
      if (!roundActive || roundOver) {
        return;
      }

      playerHand.push(drawCard());
      const playerTotal = getHandValue(playerHand);

      if (playerTotal > 21) {
        finishRound(`Bust at ${playerTotal}. Dealer wins the hand.`, "error");
        return;
      }

      statusMessage = playerTotal === 21
        ? "You hit 21. Stand."
        : `Player total ${playerTotal}.`;
      render();
    };

    const stand = () => {
      if (!roundActive || roundOver) {
        return;
      }

      while (getHandValue(dealerHand) < 17) {
        dealerHand.push(drawCard());
      }

      const playerTotal = getHandValue(playerHand);
      const dealerTotal = getHandValue(dealerHand);

      if (dealerTotal > 21) {
        const payout = Math.round(currentBet * 2);
        app.creditWinnings(payout);
        finishRound(`Dealer busts at ${dealerTotal}. ${app.formatCurrency(payout)} returned.`, "success");
        return;
      }

      if (playerTotal > dealerTotal) {
        const payout = Math.round(currentBet * 2);
        app.creditWinnings(payout);
        finishRound(`Player ${playerTotal} beats dealer ${dealerTotal}. ${app.formatCurrency(payout)} returned.`, "success");
        return;
      }

      if (playerTotal === dealerTotal) {
        app.refund(currentBet);
        finishRound(`Push at ${playerTotal}. Bet refunded.`, "info");
        return;
      }

      finishRound(`Dealer ${dealerTotal} holds over player ${playerTotal}.`, "error");
    };

    container.querySelector("#blackjackBetDown").addEventListener(
      "click",
      () => adjustBet(-100),
      { signal: abortController.signal },
    );
    container.querySelector("#blackjackBetUp").addEventListener(
      "click",
      () => adjustBet(100),
      { signal: abortController.signal },
    );
    document.addEventListener("casino830:balancechange", syncWallet, { signal: abortController.signal });
    dealButton.addEventListener("click", deal, { signal: abortController.signal });
    hitButton.addEventListener("click", hit, { signal: abortController.signal });
    standButton.addEventListener("click", stand, { signal: abortController.signal });

    syncWallet();
    render();
  }

  function destroy() {
    abortController.abort();
  }

  return { mount, destroy };
}

window.Casino830Games.createBlackjackGame = createBlackjackGame;

function drawCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { rank, suit };
}

// Aces start at 11, then drop to 1 only if the hand would otherwise bust.
function getHandValue(cards) {
  let total = 0;
  let aces = 0;

  cards.forEach((card) => {
    if (!card) {
      return;
    }

    if (card.rank === "A") {
      total += 11;
      aces += 1;
      return;
    }

    if (["K", "Q", "J"].includes(card.rank)) {
      total += 10;
      return;
    }

    total += Number(card.rank);
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function renderCard(card, hidden = false) {
  if (hidden) {
    return `
      <article class="playing-card hidden-card">
        <strong class="card-back-copy">830</strong>
      </article>
    `;
  }

  const isRed = ["♥", "♦"].includes(card.suit);
  return `
    <article class="playing-card ${isRed ? "red" : ""}">
      <div class="card-rank">${card.rank}</div>
      <div class="card-suit">${card.suit}</div>
      <div class="card-caption">${card.rank}${card.suit}</div>
    </article>
  `;
}
