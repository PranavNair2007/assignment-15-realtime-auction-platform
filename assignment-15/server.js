// server.js
// Express & Socket.io server bootstrap

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const { registerRoomHandlers, connectedBidders } = require("./sockets/roomHandler");
const { registerBidHandlers } = require("./sockets/bidHandler");
const { listAuctions } = require("./utils/auctionStore");

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Simple status/listing endpoint
app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    connectedBidders: connectedBidders.size,
    auctions: listAuctions()
  });
});

app.get("/api/auctions", (req, res) => {
  res.json({ auctions: listAuctions() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  registerRoomHandlers(io, socket);
  registerBidHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
