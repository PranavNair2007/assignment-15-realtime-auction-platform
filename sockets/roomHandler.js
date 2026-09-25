// sockets/roomHandler.js
// Handles auction:join, presence/viewer counts, and disconnects

const { getAuction } = require("../utils/auctionStore");
const { startAuctionTimer } = require("./timerManager");

// socketId -> { username, auctionId }
const connectedBidders = new Map();

function getViewerCount(io, auctionId) {
  const room = io.sockets.adapter.rooms.get(auctionId);
  return room ? room.size : 0;
}

function registerRoomHandlers(io, socket) {
  socket.on("auction:join", ({ auctionId, username }) => {
    const auction = getAuction(auctionId);
    if (!auction) {
      socket.emit("bid:rejected", { reason: "Auction not found" });
      return;
    }
    if (!username || typeof username !== "string" || !username.trim()) {
      socket.emit("bid:rejected", { reason: "A valid username is required" });
      return;
    }

    // Leave any previous auction room this socket was in
    const prev = connectedBidders.get(socket.id);
    if (prev && prev.auctionId && prev.auctionId !== auctionId) {
      socket.leave(prev.auctionId);
      io.to(prev.auctionId).emit("user:joined", {
        username: prev.username,
        totalViewers: getViewerCount(io, prev.auctionId)
      });
    }

    socket.join(auctionId);
    connectedBidders.set(socket.id, { username: username.trim(), auctionId });

    // Kick off the authoritative countdown if this is the first time it's needed
    if (auction.status === "active" && !auction.timerInterval) {
      startAuctionTimer(io, auction);
    }

    // Hydrate the newly joined bidder with current auction state
    socket.emit("auction:init", {
      item: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        startingPrice: auction.startingPrice,
        currentBid: auction.currentBid,
        highestBidder: auction.highestBidder ? auction.highestBidder.username : null,
        minIncrement: auction.minIncrement,
        status: auction.status
      },
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds
    });

    // Notify the room of the updated viewer count
    io.to(auctionId).emit("user:joined", {
      username: username.trim(),
      totalViewers: getViewerCount(io, auctionId)
    });
  });

  socket.on("disconnect", () => {
    const info = connectedBidders.get(socket.id);
    if (info && info.auctionId) {
      connectedBidders.delete(socket.id);
      io.to(info.auctionId).emit("user:joined", {
        username: info.username,
        totalViewers: getViewerCount(io, info.auctionId)
      });
    } else {
      connectedBidders.delete(socket.id);
    }
  });
}

module.exports = {
  registerRoomHandlers,
  connectedBidders,
  getViewerCount
};
