// sockets/timerManager.js
// Server-side 1s interval countdown clock per auction room

const activeTimers = new Map(); // auctionId -> interval handle

/**
 * Start (or restart) the authoritative 1-second countdown for an auction.
 * Ticks are broadcast to the room every second; when the clock hits 0 the
 * auction is closed and `auction:sold` (or `auction:unsold`) is emitted.
 */
function startAuctionTimer(io, auction) {
  stopAuctionTimer(auction.id);

  const interval = setInterval(() => {
    if (auction.status !== "active") {
      stopAuctionTimer(auction.id);
      return;
    }

    auction.timeRemainingSeconds = Math.max(0, auction.timeRemainingSeconds - 1);

    io.to(auction.id).emit("auction:time_tick", {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds
    });

    if (auction.timeRemainingSeconds <= 0) {
      closeAuction(io, auction);
    }
  }, 1000);

  activeTimers.set(auction.id, interval);
  auction.timerInterval = interval;
}

function stopAuctionTimer(auctionId) {
  const existing = activeTimers.get(auctionId);
  if (existing) {
    clearInterval(existing);
    activeTimers.delete(auctionId);
  }
}

function closeAuction(io, auction) {
  stopAuctionTimer(auction.id);
  auction.status = "ended";

  if (auction.highestBidder) {
    io.to(auction.id).emit("auction:sold", {
      auctionId: auction.id,
      winner: auction.highestBidder.username,
      finalPrice: auction.currentBid,
      status: "sold"
    });
  } else {
    io.to(auction.id).emit("auction:sold", {
      auctionId: auction.id,
      winner: null,
      finalPrice: auction.currentBid,
      status: "unsold"
    });
  }
}

module.exports = {
  startAuctionTimer,
  stopAuctionTimer,
  closeAuction
};
