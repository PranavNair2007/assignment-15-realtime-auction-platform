// sockets/bidHandler.js
// Wires client bid:place events to the authoritative auction engine

const { getAuction } = require("../utils/auctionStore");
const { handleBidPlacement } = require("./auctionEngine");
const { connectedBidders } = require("./roomHandler");

function registerBidHandlers(io, socket) {
  socket.on("bid:place", ({ auctionId, amount }) => {
    const auction = getAuction(auctionId);
    if (!auction) {
      socket.emit("bid:rejected", { reason: "Auction not found" });
      return;
    }

    const bidder = connectedBidders.get(socket.id);
    if (!bidder || bidder.auctionId !== auctionId) {
      socket.emit("bid:rejected", { reason: "Join the auction room before bidding" });
      return;
    }

    handleBidPlacement(io, socket, auction, Number(amount), bidder.username);
  });
}

module.exports = { registerBidHandlers };
