# Uncharted Lands - Game Server

Real-time multiplayer game server using Socket.IO and TypeScript.

---

## 📁 Project Structure

```
server/
├── src/
│   ├── index.ts                           # Main server entry point
│   ├── types/
│   │   └── socket-events.ts              # TypeScript event definitions
│   ├── events/
│   │   └── handlers.ts                   # Socket.IO event handlers
│   ├── middleware/
│   │   └── socket-middleware.ts          # Authentication, logging, error handling
│   ├── utils/
│   │   └── logger.ts                     # Centralized logging utility
│   └── game/                             # Game logic (to be implemented)
│       ├── loop.ts                       # Game loop
│       ├── production.ts                 # Resource production
│       ├── consumption.ts                # Resource consumption
│       └── state-manager.ts              # Game state management
├── docs/                                  # Documentation (wiki)
├── package.json
├── tsconfig.json
└── .env.example                          # Environment variables template
```

---

## 🏗️ Architecture

### Socket.IO with TypeScript

The server uses **strongly-typed Socket.IO** for type safety:

```typescript
// All events are typed
const io = new Server<
  ClientToServerEvents,    // Events client can send
  ServerToClientEvents,    // Events server can send
  InterServerEvents,       // Events between server instances
  SocketData              // Data attached to each socket
>(httpServer, options);
```

### Event-Driven Design

```
Client → Socket.IO → Middleware → Event Handler → Game Logic → Database
                                                              ↓
Client ← Socket.IO ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← Response
```

### Middleware Pipeline

1. **Logging Middleware** - Logs all connections and events
2. **Authentication Middleware** - Validates tokens (in production)
3. **Error Handling Middleware** - Catches errors, prevents crashes

### Event Handlers

Organized in `events/handlers.ts`:
- `authenticate` - Player authentication
- `join-world` / `leave-world` - World management
- `request-game-state` - State synchronization
- `build-structure` - Settlement building
- `collect-resources` - Resource collection

### Room-Based Broadcasting

```typescript
// Join a world (creates/joins room)
socket.join(`world:${worldId}`);

// Broadcast to everyone in that world
io.to(`world:${worldId}`).emit('state-update', data);
```

---

## 🚀 Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Server starts on `http://localhost:3001` with hot-reload.

### Production Build

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run type-check
```

---

## 🔧 Configuration

### Environment Variables

See `.env.example` for all options:

```env
# Server
PORT=3001
HOST=0.0.0.0

# CORS
CORS_ORIGINS=http://localhost:5173

# Logging
LOG_LEVEL=INFO

# Database
DATABASE_URL=postgresql://...
```

### Socket.IO Options

Configured in `src/index.ts`:

```typescript
{
  cors: { /* ... */ },
  pingTimeout: 60000,      // 60s before considering connection dead
  pingInterval: 25000,     // Send ping every 25s
  maxHttpBufferSize: 1e6,  // 1MB max message size
  perMessageDeflate: true, // Compression (production only)
}
```

---

## 📡 API Reference

### Client → Server Events

```typescript
// Authentication
socket.emit('authenticate', {
  playerId: string,
  token?: string
}, (response) => {
  // Acknowledgment callback
});

// World Management
socket.emit('join-world', {
  worldId: string,
  playerId: string
});

socket.emit('leave-world', {
  worldId: string,
  playerId: string
});

// Game State
socket.emit('request-game-state', {
  worldId: string
});

// Settlement Actions
socket.emit('build-structure', {
  settlementId: string,
  structureType: string
}, (response) => {
  // Acknowledgment callback
});

socket.emit('collect-resources', {
  settlementId: string
}, (response) => {
  // Acknowledgment callback
});
```

### Server → Client Events

```typescript
// Connection
socket.on('connected', (data) => {
  // { message, socketId, timestamp }
});

// Authentication
socket.on('authenticated', (data) => {
  // { success, playerId?, error? }
});

// World
socket.on('world-joined', (data) => {
  // { worldId, timestamp }
});

socket.on('player-joined', (data) => {
  // { playerId, timestamp }
});

socket.on('player-left', (data) => {
  // { playerId, timestamp }
});

// Game State
socket.on('game-state', (data) => {
  // { worldId, state, timestamp }
});

socket.on('state-update', (data) => {
  // { worldId, update, timestamp }
});

// Resources
socket.on('structure-built', (data) => {
  // { success, settlementId, structureType, timestamp }
});

socket.on('resources-collected', (data) => {
  // { success, settlementId, resources, timestamp }
});

socket.on('resource-tick', (data) => {
  // { settlementId, resources, production, consumption, timestamp }
});

// Errors
socket.on('error', (data) => {
  // { code, message, timestamp }
});
```

---

## 🧪 Testing

### Manual Testing

1. Start server: `npm run dev`
2. Check health: `curl http://localhost:3001/health`
3. Connect with client or use Socket.IO client directly

### Using Socket.IO Client

```bash
npm install -g socket.io-client
```

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3001');

socket.on('connected', (data) => {
  console.log('Connected:', data);
  
  socket.emit('authenticate', { playerId: 'test123' }, (response) => {
    console.log('Auth response:', response);
  });
});
```

---

## 🔒 Security

### Authentication

- Production mode requires valid tokens
- Development mode allows all connections (for testing)
- Tokens validated in `authenticationMiddleware`

### Rate Limiting

- Will be implemented to prevent spam/abuse
- Configurable thresholds
- Per-socket tracking

### Input Validation

- All event data validated before processing
- Type safety via TypeScript
- Sanitization in handlers

---

## 📊 Monitoring

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 12345.67,
  "connections": 42,
  "environment": "development",
  "timestamp": "2025-11-06T..."
}
```

### Logging

Structured logs with levels:
- `DEBUG` - Detailed debugging info
- `INFO` - General information
- `WARN` - Warnings (non-critical)
- `ERROR` - Errors (with stack traces)

Set log level via `LOG_LEVEL` environment variable.

### Metrics

Get stats programmatically:

```typescript
import { getStats } from './index';

const stats = getStats();
// { connections, uptime, environment }
```

---

## 🚧 TODO

### Phase 1: Foundation (Current)
- ✅ Socket.IO setup with TypeScript
- ✅ Event handlers
- ✅ Middleware (auth, logging, errors)
- ✅ Room-based broadcasting
- ✅ Graceful shutdown

### Phase 2: Game Loop
- ⏳ Implement 60Hz game loop
- ⏳ Resource production/consumption
- ⏳ Settlement processing
- ⏳ State management

### Phase 3: Database Integration
- ⏳ Prisma client setup
- ⏳ Share schema with client
- ⏳ Query optimization
- ⏳ Transaction handling

### Phase 4: Caching
- ⏳ Redis integration
- ⏳ State caching
- ⏳ Session management
- ⏳ Pub/sub for multi-server

### Phase 5: Production
- ⏳ JWT authentication
- ⏳ Rate limiting
- ⏳ Monitoring/metrics
- ⏳ Horizontal scaling

---

## 🤝 Contributing

### Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Format with Prettier
- Add JSDoc comments for public APIs

### Adding New Events

1. Define types in `types/socket-events.ts`
2. Add handler in `events/handlers.ts`
3. Update this README
4. Add tests (when testing is set up)

### Best Practices

- ✅ Always use typed events
- ✅ Use acknowledgment callbacks for actions
- ✅ Log all important events
- ✅ Handle errors gracefully (never crash loop)
- ✅ Validate all input data
- ✅ Use rooms for world-specific broadcasts

---

## 📚 Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

*For more documentation, see the [Wiki](./docs/README.md)*
