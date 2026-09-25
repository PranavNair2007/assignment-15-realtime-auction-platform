# 🔨 Assignment 15: Real-Time Live Auction & Bidding Engine (Socket.io)

**Author:** Anant Dhoundiyal
**Tech Stack:** Node.js, Express.js, Socket.io, In-Memory State Engine, Timer Synchronizer, CORS

An authoritative real-time bidding platform with race-condition-safe bid validation, targeted outbid alerts, a server-synced countdown clock, and anti-snipe timer extensions.

## Features

- Authoritative server-side bid validation (minimum increment, self-outbid prevention, closed-auction rejection)
- Real-time leading-price broadcasts to every participant in an auction room
- Targeted private "outbid" alerts sent only to the previous highest bidder
- Server-side 1-second countdown clock, synchronized across all clients
- Anti-snipe protection: a bid inside the final 15 seconds resets the clock to 20 seconds
- Auditable bid history feed per auction, plus a live viewer/audience counter
- `auction:sold` (or `unsold`) event when the clock hits zero, after which further bids are rejected

## Project structure

```
Anant Dhoundiyal/
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── sockets/
│   ├── auctionEngine.js     # Bid validation, outbid alerts & anti-snipe logic
│   ├── timerManager.js      # Server-side 1s interval countdown clock
│   ├── roomHandler.js       # auction:join, presence & viewer counts
│   └── bidHandler.js        # Wires bid:place events to the engine
├── utils/
│   └── auctionStore.js      # In-memory auction room state
├── server.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Setup

```bash
# Install dependencies
npm install

# Copy env file and adjust if needed
cp .env.example .env

# Run in development (auto-restart)
npm run dev

# Or run normally
npm start
```

The server starts at **http://localhost:5000** by default. Three sample auctions are seeded in memory on startup.

## Socket event protocol

### Room & stream events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `auction:join` | Client → Server | `{ auctionId, username }` | Joins the live bidding floor |
| `auction:init` | Server → Client | `{ item, bidHistory, timeRemaining }` | Hydrates state for a new joiner |
| `auction:time_tick` | Server → Room | `{ auctionId, timeRemaining }` | Broadcast every second |
| `user:joined` | Server → Room | `{ username, totalViewers }` | Updates live audience count |

### Live bidding actions

| Event | Direction | Payload | Description |
|---|---|---|---|
| `bid:place` | Client → Server | `{ auctionId, amount }` | Places a bid |
| `bid:success` | Server → Room | `{ currentBid, highestBidder, bidHistory, timeRemaining }` | New leading price |
| `bid:outbid` | Server → Client | `{ message }` | Sent only to the previous highest bidder |
| `bid:rejected` | Server → Client | `{ reason }` | Invalid bid rejection |
| `auction:extended` | Server → Room | `{ timeRemaining, message }` | Anti-snipe triggered |
| `auction:sold` | Server → Room | `{ winner, finalPrice, status }` | Auction closed |

## Authoritative bidding rules

1. Auction must be `active` with time remaining.
2. A bidder can't outbid themselves.
3. A bid must meet `currentBid + minIncrement`.
4. Anti-snipe: a valid bid placed with under 15 seconds left resets the clock to 20 seconds.
5. All state mutation happens server-side — the client never dictates price or time.

## Manual testing

1. Start the server (`npm run dev`).
2. Open three browser tabs on the auction page: Bidder A (Vikram), Bidder B (Ananya), and Viewer C — all joined to the same auction room.
3. Place a bid from Vikram — confirm all three screens update the current highest bid instantly.
4. Place a higher bid from Ananya — confirm Vikram receives an outbid toast alert.
5. Wait until the timer drops under 15 seconds, then place a valid bid — confirm the clock jumps back to 20 seconds with an "extended" toast.
6. Let the clock reach 0 — confirm `auction:sold` fires and further bid attempts are rejected.

## Notes

- Auction state is stored in memory and resets when the server restarts.
- Three auctions are seeded by default (`AUC_VINTAGE_99`, `AUC_POCKETWATCH_12`, `AUC_PAINTING_07`); pick one from the login screen.
