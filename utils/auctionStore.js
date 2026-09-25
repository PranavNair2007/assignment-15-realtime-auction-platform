// utils/auctionStore.js
// In-memory auction room state

const { v4: uuidv4 } = require("uuid");

// auctionId -> auction object
const auctions = {
  AUC_VINTAGE_99: {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original condition rare electric guitar, sunburst finish.",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active", // "upcoming" | "active" | "ended"
    bidHistory: [],
    timerInterval: null
  },
  AUC_POCKETWATCH_12: {
    id: "AUC_POCKETWATCH_12",
    title: "Antique Brass Pocket Watch",
    description: "19th-century engraved brass pocket watch, working condition.",
    startingPrice: 12000,
    currentBid: 12000,
    highestBidder: null,
    minIncrement: 500,
    timeRemainingSeconds: 60,
    status: "active",
    bidHistory: [],
    timerInterval: null
  },
  AUC_PAINTING_07: {
    id: "AUC_PAINTING_07",
    title: "Untitled Oil Landscape, 1958",
    description: "Original oil-on-canvas landscape painting, framed.",
    startingPrice: 30000,
    currentBid: 30000,
    highestBidder: null,
    minIncrement: 1500,
    timeRemainingSeconds: 60,
    status: "active",
    bidHistory: [],
    timerInterval: null
  }
};

function getAuction(auctionId) {
  return auctions[auctionId] || null;
}

function listAuctions() {
  return Object.values(auctions).map((a) => ({
    id: a.id,
    title: a.title,
    currentBid: a.currentBid,
    status: a.status,
    timeRemainingSeconds: a.timeRemainingSeconds
  }));
}

function generateBidId() {
  return uuidv4();
}

module.exports = {
  auctions,
  getAuction,
  listAuctions,
  generateBidId
};
