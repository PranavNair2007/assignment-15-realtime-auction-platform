// public/app.js
// Client socket handlers & bid controls for the live auction floor

const socket = io();

let currentUsername = null;
let currentAuctionId = null;
let currentBid = 0;
let minIncrement = 0;
let auctionStatus = "active";

// ---------- DOM refs ----------

const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");
const usernameInput = document.getElementById("username-input");
const auctionSelect = document.getElementById("auction-select");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

const itemTitle = document.getElementById("item-title");
const itemDesc = document.getElementById("item-desc");
const viewerCount = document.getElementById("viewer-count");

const currentBidValue = document.getElementById("current-bid-value");
const highestBidderLine = document.getElementById("highest-bidder-line");
const timerValue = document.getElementById("timer-value");

const bidInput = document.getElementById("bid-input");
const bidBtn = document.getElementById("bid-btn");
const quickBids = document.getElementById("quick-bids");
const bidFeedback = document.getElementById("bid-feedback");
const bidHistoryEl = document.getElementById("bid-history");

const soldBanner = document.getElementById("sold-banner");
const soldTitle = document.getElementById("sold-title");
const soldSub = document.getElementById("sold-sub");

const auctionListEl = document.getElementById("auction-list");
const toastStack = document.getElementById("toast-stack");

// ---------- Formatting ----------

function formatINR(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

// ---------- Login ----------

function doLogin() {
  const name = usernameInput.value.trim();
  const auctionId = auctionSelect.value;
  if (!name) {
    loginError.textContent = "Please enter your name.";
    return;
  }
  loginError.textContent = "";
  currentUsername = name;
  currentAuctionId = auctionId;
  socket.emit("auction:join", { auctionId, username: name });
}

loginBtn.addEventListener("click", doLogin);
usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

socket.on("bid:rejected", (payload) => {
  // Rejections before we've entered the floor are login/join errors
  if (loginScreen.style.display !== "none") {
    loginError.textContent = payload.reason;
    return;
  }
  showBidFeedback(payload.reason, "error");
});

// ---------- Hydration on join ----------

socket.on("auction:init", ({ item, bidHistory, timeRemaining }) => {
  loginScreen.style.display = "none";
  app.classList.add("active");

  itemTitle.textContent = item.title;
  itemDesc.textContent = item.description;
  currentBid = item.currentBid;
  minIncrement = item.minIncrement;
  auctionStatus = item.status;

  currentBidValue.textContent = formatINR(item.currentBid);
  highestBidderLine.innerHTML = item.highestBidder
    ? `Leading: <span>${escapeHtml(item.highestBidder)}</span>`
    : "No bids yet";

  updateTimerDisplay(timeRemaining);
  renderQuickBids();
  renderHistory(bidHistory);

  if (item.status === "ended") {
    disableBidding("Auction has ended");
  }

  fetchOtherAuctions();
});

// ---------- Live ticks ----------

socket.on("auction:time_tick", ({ auctionId, timeRemaining }) => {
  if (auctionId !== currentAuctionId) return;
  updateTimerDisplay(timeRemaining);
});

function updateTimerDisplay(seconds) {
  timerValue.textContent = `${seconds}s`;
  timerValue.classList.toggle("urgent", seconds <= 15 && seconds > 0);
}

// ---------- Presence ----------

socket.on("user:joined", ({ totalViewers }) => {
  viewerCount.textContent = totalViewers;
});

// ---------- Bidding ----------

function renderQuickBids() {
  quickBids.innerHTML = "";
  [1, 2, 5].forEach((mult) => {
    const amount = currentBid + minIncrement * mult;
    const btn = document.createElement("button");
    btn.className = "quick-bid-btn";
    btn.textContent = `+${formatINR(minIncrement * mult)}`;
    btn.addEventListener("click", () => placeBid(amount));
    quickBids.appendChild(btn);
  });
}

function placeBid(amount) {
  if (auctionStatus !== "active") return;
  const bidAmount = Number(amount);
  if (!bidAmount || bidAmount <= 0) {
    showBidFeedback("Enter a valid bid amount", "error");
    return;
  }
  socket.emit("bid:place", { auctionId: currentAuctionId, amount: bidAmount });
}

bidBtn.addEventListener("click", () => {
  placeBid(bidInput.value);
});

bidInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") placeBid(bidInput.value);
});

function showBidFeedback(text, kind) {
  bidFeedback.textContent = text;
  bidFeedback.className = kind;
  if (kind === "success") {
    setTimeout(() => {
      if (bidFeedback.textContent === text) bidFeedback.textContent = "";
    }, 3000);
  }
}

function disableBidding(reason) {
  bidBtn.disabled = true;
  bidInput.disabled = true;
  showBidFeedback(reason, "error");
}

// ---------- Bid success / history ----------

socket.on("bid:success", ({ auctionId, currentBid: newBid, highestBidder, bidHistory, timeRemaining }) => {
  if (auctionId !== currentAuctionId) return;

  currentBid = newBid;
  currentBidValue.textContent = formatINR(newBid);
  highestBidderLine.innerHTML = `Leading: <span>${escapeHtml(highestBidder)}</span>`;
  updateTimerDisplay(timeRemaining);
  renderQuickBids();
  renderHistory(bidHistory);
  bidInput.value = "";

  if (highestBidder === currentUsername) {
    showBidFeedback("You're the highest bidder!", "success");
  } else {
    bidFeedback.textContent = "";
  }
});

function renderHistory(history) {
  bidHistoryEl.innerHTML = "";
  if (!history || history.length === 0) {
    const div = document.createElement("div");
    div.className = "history-row";
    div.textContent = "No bids placed yet.";
    bidHistoryEl.appendChild(div);
    return;
  }
  history.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "history-row";
    row.innerHTML = `
      <span>${escapeHtml(entry.bidder)}</span>
      <span class="amount">${formatINR(entry.amount)}</span>
      <span class="time">${entry.timestamp}</span>
    `;
    bidHistoryEl.appendChild(row);
  });
}

// ---------- Outbid alerts ----------

socket.on("bid:outbid", ({ auctionId, message }) => {
  if (auctionId !== currentAuctionId) return;
  showToast(message, "outbid");
});

// ---------- Anti-snipe extension ----------

socket.on("auction:extended", ({ auctionId, timeRemaining, message }) => {
  if (auctionId !== currentAuctionId) return;
  updateTimerDisplay(timeRemaining);
  showToast(message, "extended");
});

// ---------- Auction sold/closed ----------

socket.on("auction:sold", ({ auctionId, winner, finalPrice, status }) => {
  if (auctionId !== currentAuctionId) return;

  auctionStatus = "ended";
  disableBidding("Auction has ended");

  soldBanner.classList.add("active");
  if (status === "sold") {
    soldTitle.textContent = `Sold to ${winner}`;
    soldSub.textContent = `Final price: ${formatINR(finalPrice)}`;
    showToast(`Auction closed — sold to ${winner} for ${formatINR(finalPrice)}`, "sold");
  } else {
    soldTitle.textContent = "Auction ended — no winning bid";
    soldSub.textContent = "";
    showToast("Auction closed with no bids", "sold");
  }
});

// ---------- Toasts ----------

function showToast(message, kind) {
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.textContent = message;
  toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ---------- Other auctions sidebar ----------

function fetchOtherAuctions() {
  fetch("/api/auctions")
    .then((res) => res.json())
    .then(({ auctions }) => {
      auctionListEl.innerHTML = "";
      auctions.forEach((a) => {
        const div = document.createElement("div");
        div.className = `auction-item ${a.id === currentAuctionId ? "active" : ""}`;
        div.innerHTML = `
          <div class="name">${escapeHtml(a.title)}</div>
          <div class="price">${formatINR(a.currentBid)} · ${a.status}</div>
        `;
        auctionListEl.appendChild(div);
      });
    })
    .catch(() => {});
}

// Keep the sidebar reasonably fresh
setInterval(() => {
  if (currentAuctionId) fetchOtherAuctions();
}, 5000);

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
