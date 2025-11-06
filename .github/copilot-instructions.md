````instructions
# GitHub Copilot Instructions for Uncharted Lands Server

This file provides context and guidelines for GitHub Copilot when working on the Uncharted Lands WebSocket server.

---

## Project Overview

**Uncharted Lands Server** is a real-time WebSocket server for the Uncharted Lands game, handling multiplayer game state synchronization, player actions, and real-time events.

**Tech Stack**:
- **Runtime**: Node.js 22.x
- **Language**: TypeScript 5.7.3
- **WebSocket Library**: ws 8.18.0
- **Build Tool**: tsx (dev) / tsc (production)
- **Deployment**: Railway or Render (persistent WebSocket connections)
- **Environment**: dotenv for configuration

---

## Architecture

### Server Purpose

This WebSocket server handles:
- **Real-time multiplayer**: Player connections and state synchronization
- **Game events**: Broadcasting events to connected players
- **Player actions**: Processing and validating player inputs
- **Health checks**: HTTP endpoint for monitoring

### Why Separate Server?

- **Vercel limitations**: Vercel's serverless functions cannot maintain persistent WebSocket connections
- **Deployment target**: Railway or Render support long-running WebSocket processes
- **Independent scaling**: Server can scale independently from the SvelteKit client

### Client-Server Communication

- **Client**: SvelteKit app on Vercel (`uncharted-lands` repo)
- **Server**: WebSocket server on Railway/Render (`uncharted-lands-server` repo)
- **Protocol**: JSON messages over WebSocket
- **Health endpoint**: HTTP GET `/health` for monitoring

---

## Official Documentation References

### WebSocket (ws) Library

- **GitHub**: https://github.com/websockets/ws
- **API Docs**: https://github.com/websockets/ws/blob/master/doc/ws.md
- **Examples**: https://github.com/websockets/ws/tree/master/examples

### Node.js

- **HTTP Server**: https://nodejs.org/api/http.html
- **Process**: https://nodejs.org/api/process.html
- **Events**: https://nodejs.org/api/events.html

### TypeScript

- **Handbook**: https://www.typescriptlang.org/docs/handbook/intro.html
- **ES Modules**: https://www.typescriptlang.org/docs/handbook/esm-node.html

---

## Project Structure

```
uncharted-lands-server/
├── .github/
│   ├── copilot-instructions.md          # This file
│   └── workflows/                       # CI/CD workflows
├── src/
│   └── index.ts                         # Main WebSocket server
├── .env.example                         # Environment variables template
├── .gitignore                           # Git ignore rules
├── eslint.config.js                     # ESLint configuration
├── package.json                         # Dependencies and scripts
├── .prettierrc                          # Code formatting
├── README.md                            # Project documentation
└── tsconfig.json                        # TypeScript configuration
```

### Key Files

- **src/index.ts**: Main WebSocket server with:
  - HTTP server for health checks (`/health`)
  - WebSocket server for game connections
  - Message handling and broadcasting
  - Graceful shutdown handling

- **.env**: Configuration (never commit!)
  - `PORT`: Server port (default: 8080)
  - `HOST`: Bind address (default: 0.0.0.0)
  - `DATABASE_URL`: PostgreSQL connection (if needed)
  - `SENTRY_DSN`: Error tracking (optional)

---

## Code Style Guidelines

### TypeScript Patterns

**Use ES Modules** (not CommonJS):

```typescript
// ✅ CORRECT
import { WebSocketServer } from 'ws';
export function broadcast(message: object) { }

// ❌ WRONG
const { WebSocketServer } = require('ws');
module.exports = { broadcast };
```

**Strict Type Safety**:

```typescript
// ✅ Explicit types
function handleMessage(data: Buffer): void {
  const message: GameMessage = JSON.parse(data.toString());
}

// ❌ Implicit any
function handleMessage(data) {
  const message = JSON.parse(data.toString());
}
```

**Async/Await for Promises**:

```typescript
// ✅ Modern async/await
async function fetchData(): Promise<GameState> {
  const response = await fetch(url);
  return await response.json();
}

// ❌ Promise chains
function fetchData() {
  return fetch(url).then(res => res.json());
}
```

### WebSocket Patterns

**Connection Handling**:

```typescript
wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  // Track client
  clients.add(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({ type: 'connected' }));
  
  // Handle messages
  ws.on('message', handleMessage);
  
  // Clean up on disconnect
  ws.on('close', () => clients.delete(ws));
});
```

**Message Broadcasting**:

```typescript
function broadcast(message: object): void {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
```

**Error Handling**:

```typescript
ws.on('error', (error: Error) => {
  console.error('WebSocket error:', error);
  clients.delete(ws);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  wss.clients.forEach((client) => {
    client.close(1000, 'Server shutting down');
  });
  server.close();
});
```

---

## Message Protocol

### Client → Server

```typescript
// Player action
{
  type: 'player_action',
  action: 'move' | 'gather' | 'build',
  payload: { ... },
  timestamp: number
}

// Join game
{
  type: 'join_game',
  playerId: string,
  gameId: string,
  timestamp: number
}
```

### Server → Client

```typescript
// Game state update
{
  type: 'state_update',
  state: GameState,
  timestamp: number
}

// Error response
{
  type: 'error',
  message: string,
  timestamp: number
}

// Player joined
{
  type: 'player_joined',
  playerId: string,
  timestamp: number
}
```

---

## Common Tasks & Patterns

### Adding New Message Types

1. Define TypeScript interfaces:

```typescript
// src/types/messages.ts
export interface PlayerActionMessage {
  type: 'player_action';
  action: string;
  payload: unknown;
  timestamp: number;
}
```

2. Add handler in `src/index.ts`:

```typescript
ws.on('message', (data: Buffer) => {
  const message = JSON.parse(data.toString());
  
  switch (message.type) {
    case 'player_action':
      handlePlayerAction(ws, message);
      break;
    // ... other cases
  }
});
```

### Broadcasting to Specific Clients

```typescript
// Broadcast to all clients
function broadcastToAll(message: object): void {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Broadcast to specific game room
function broadcastToRoom(roomId: string, message: object): void {
  const payload = JSON.stringify(message);
  const roomClients = rooms.get(roomId);
  
  roomClients?.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
```

### Health Check Endpoint

```typescript
// Already implemented in src/index.ts
http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      uptime: process.uptime(),
      connections: clients.size 
    }));
  }
});
```

---

## Testing

### Manual WebSocket Testing

Using `wscat` (install globally):

```powershell
# Install
npm install -g wscat

# Connect to server
wscat -c ws://localhost:8080

# Send messages
> {"type":"join_game","playerId":"player1","gameId":"game123"}
```

### Testing with Client

```typescript
// From SvelteKit client
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'join_game', playerId: 'player1' }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Health Check Testing

```powershell
# Test health endpoint
Invoke-WebRequest -Uri http://localhost:8080/health

# Expected response
{"status":"healthy","uptime":123.456,"connections":0}
```

---

## Do's and Don'ts

### ✅ DO

- Use ES modules (import/export)
- Type all function parameters and return values
- Handle WebSocket errors gracefully
- Clean up clients on disconnect
- Use JSON for all messages
- Log important events
- Implement health checks
- Support graceful shutdown
- Validate incoming messages
- Use environment variables for config

### ❌ DON'T

- Don't use CommonJS (require/module.exports)
- Don't use `any` type without good reason
- Don't ignore WebSocket errors
- Don't leave orphaned connections
- Don't send unstructured data
- Don't log sensitive information
- Don't hardcode configuration
- Don't block the event loop
- Don't trust client input without validation
- Don't commit `.env` files

---

## Deployment

### Railway Deployment

1. **Create New Project**: Link GitHub repo
2. **Configure Environment**: Add environment variables
3. **Set Start Command**: `npm start`
4. **Configure Port**: Railway provides `PORT` env var
5. **Deploy**: Automatic from `main` branch

### Render Deployment

1. **New Web Service**: Link GitHub repo
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npm start`
4. **Environment**: Add variables in dashboard
5. **Health Check**: `/health` endpoint

### Environment Variables

Required for production:

```env
PORT=8080                    # Provided by platform
HOST=0.0.0.0                 # Bind all interfaces
DATABASE_URL=postgresql://... # If using database
SENTRY_DSN=https://...       # Optional error tracking
```

---

## Useful Commands

```powershell
# Development
npm run dev              # Start dev server with auto-reload (tsx watch)
npm run build            # Build TypeScript to dist/
npm start                # Run production build (node dist/index.js)

# Code Quality
npm run type-check       # TypeScript type checking
npm run lint             # ESLint code checking
npm run format           # Format code with Prettier

# Package Management
npm install              # Install dependencies
npm update               # Update dependencies
npm audit                # Check for vulnerabilities

# Testing WebSocket
npm install -g wscat    # Install WebSocket test tool
wscat -c ws://localhost:8080  # Connect to server

# Deployment
git push origin main     # Trigger Railway/Render deployment
railway up               # Manual Railway deploy
render deploy            # Manual Render deploy

# Git
git status               # Check status
git log --oneline -10    # Recent commits
```

---

## Additional Resources

### WebSocket
- MDN WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- ws Library: https://github.com/websockets/ws

### Node.js
- Node.js Docs: https://nodejs.org/docs/
- Best Practices: https://github.com/goldbergyoni/nodebestpractices

### TypeScript
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- TS Node: https://github.com/TypeStrong/ts-node

### Deployment
- Railway Docs: https://docs.railway.app/
- Render Docs: https://render.com/docs

---

## Questions or Unsure?

1. **Check ws library docs**: https://github.com/websockets/ws/blob/master/doc/ws.md
2. **Review Node.js HTTP docs**: https://nodejs.org/api/http.html
3. **Check TypeScript handbook**: https://www.typescriptlang.org/docs/
4. **Ask the team** - Don't make assumptions!

---

**Last Updated**: November 2025  
**Status**: Initial setup complete  
**Tech Stack**: TypeScript + ws + Node.js 22.x  
**Deployment**: Railway or Render (persistent WebSocket connections)

````