// sockets/auctionEngine.js
// Authoritative bid validation, outbid alerts & anti-snipe logic

const ANTI_SNIPE_THRESHOLD_SECONDS = 15;
const ANTI_SNIPE_EXTENSION_SECONDS = 20;

/**
 * Validate and apply a bid to an auction's in-memory state, then broadcast
 * the outcome. This is the single authoritative path for state mutation —
 * the server never trusts a client's view of currentBid or timeRemaining.
 */
function handleBidPlacement(io, socket, auction, bidAmount, username) {
  // 1. Auction must be active and have time left
  if (auction.status !== "active" || auction.timeRemainingSeconds <= 0) {
    return socket.emit("bid:rejected", { reason: "Auction is closed" });
  }

  // 2. Bid amount must be a valid positive number
  if (typeof bidAmount !== "number" || !Number.isFinite(bidAmount) || bidAmount <= 0) {
    return socket.emit("bid:rejected", { reason: "Invalid bid amount" });
  }

  // 3. Prevent a bidder from outbidding themselves
  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit("bid:rejected", { reason: "You are already the highest bidder" });
  }

  // 4. Enforce minimum increment
  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (bidAmount < minimumRequired) {
    return socket.emit("bid:rejected", {
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString("en-IN")}`
    });
  }

  // 5. Capture previous highest bidder before mutating state
  const previousBidder = auction.highestBidder;

  // 6. Apply state update
  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString()
  });
  // Keep the audit feed bounded
  if (auction.bidHistory.length > 50) {
    auction.bidHistory.length = 50;
  }

  // 7. Anti-snipe rule: bid in the final stretch resets the clock
  let extended = false;
  if (auction.timeRemainingSeconds < ANTI_SNIPE_THRESHOLD_SECONDS) {
    auction.timeRemainingSeconds = ANTI_SNIPE_EXTENSION_SECONDS;
    extended = true;
    io.to(auction.id).emit("auction:extended", {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds,
      message: `Bid in final seconds: Timer extended by ${ANTI_SNIPE_EXTENSION_SECONDS}s!`
    });
  }

  // 8. Broadcast the new leading bid to everyone in the room
  io.to(auction.id).emit("bid:success", {
    auctionId: auction.id,
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds,
    extended
  });

  // 9. Privately notify whoever just got outbid
  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit("bid:outbid", {
      auctionId: auction.id,
      message: `You were outbid by ${username} with ₹${bidAmount.toLocaleString("en-IN")}!`
    });
  }
}

module.exports = {
  handleBidPlacement,
  ANTI_SNIPE_THRESHOLD_SECONDS,
  ANTI_SNIPE_EXTENSION_SECONDS
};
