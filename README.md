# Uncharted Lands Server

Real-time WebSocket server for the Uncharted Lands game, handling multiplayer state synchronization, player actions, and game events.

## Tech Stack

- **Node.js** 22.x
- **TypeScript** 5.7.3
- **WebSocket Library**: ws 8.18.0
- **Build Tool**: tsx (dev) / tsc (production)
- **Deployment**: Railway or Render

## Getting Started

### Prerequisites

- Node.js 22.x
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
```

### Development

```bash
# Start development server with auto-reload
npm run dev

# The server will start on http://localhost:8080
# WebSocket endpoint: ws://localhost:8080
# Health check: http://localhost:8080/health
```

### Building

```bash
# Build TypeScript to dist/
npm run build

# Run production build
npm start
```

### Testing

```bash
# Install wscat globally for WebSocket testing
npm install -g wscat

# Connect to local server
wscat -c ws://localhost:8080

# Send test message
> {"type":"join_game","playerId":"player1","gameId":"game123"}
```

## Project Structure

```
src/
└── index.ts          # Main WebSocket server entry point
```

## Environment Variables

Create a `.env` file with the following:

```env
PORT=8080                    # Server port
HOST=0.0.0.0                 # Bind address
DATABASE_URL=postgresql://... # PostgreSQL connection (if needed)
SENTRY_DSN=https://...       # Sentry error tracking (optional)
```

## Message Protocol

### Client → Server

```json
{
  "type": "join_game",
  "playerId": "player123",
  "gameId": "game456",
  "timestamp": 1234567890
}
```

### Server → Client

```json
{
  "type": "state_update",
  "state": { ... },
  "timestamp": 1234567890
}
```

## Deployment

### Railway

1. Create new project and link GitHub repo
2. Add environment variables in dashboard
3. Deploy automatically from `main` branch

### Render

1. Create new Web Service
2. Set build command: `npm install && npm run build`
3. Set start command: `npm start`
4. Configure environment variables

## Why Separate Server?

This WebSocket server is deployed separately from the SvelteKit client because:

- **Vercel limitations**: Vercel's serverless functions cannot maintain persistent WebSocket connections
- **Deployment target**: Railway and Render support long-running WebSocket processes
- **Independent scaling**: Server can scale independently from the client

## Contributing

See the main [Uncharted Lands repository](https://github.com/KungRaseri/uncharted-lands) for contribution guidelines.

## License

MIT
