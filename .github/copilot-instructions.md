````instructions
# GitHub Copilot Instructions for Uncharted Lands Server

This file provides context and guidelines for GitHub Copilot when working on the Uncharted Lands game server.

---

## ⚠️ CRITICAL: Documentation Creation Policy

**NEVER create documentation, summaries, status files, or markdown files unless explicitly requested by the user.**

### Rules:
1. **DO NOT** automatically create:
   - Summary documents (SUMMARY.md, STATUS.md, CHANGES.md, etc.)
   - Migration status files
   - Progress reports
   - Documentation files
   - README files (except when specifically asked)

2. **ONLY create documentation when**:
   - The user explicitly asks: "Create a summary", "Write documentation for X", etc.
   - The user requests: "Document this", "Add a README", etc.

3. **Instead of creating documents**:
   - Answer questions directly in chat
   - Provide explanations in the conversation
   - Make code changes as requested
   - Update existing documentation if it already exists

4. **When documentation IS requested**:
   - Confirm what they want documented
   - Follow the Documentation Policy below for placement

---

## Project Overview

**Uncharted Lands Server** is a real-time game server for the Uncharted Lands game, handling multiplayer game state, player actions, resource production, and real-time events.

**Tech Stack**:
- **Runtime**: Node.js 22.x
- **Language**: TypeScript 5.7.3
- **Real-Time**: Socket.IO 4.8.1
- **Database**: Drizzle ORM + PostgreSQL
- **Build**: tsx (dev) / tsc (production)
- **Deployment**: Railway or Render (persistent connections)
- **Environment**: dotenv for configuration

---

## Documentation Policy

**⚠️ CRITICAL: ALL project documentation MUST be placed in the `docs/` directory.**

### Documentation Rules

1. **Location**: ALL `.md` documentation files go in `docs/` directory
   - ✅ CORRECT: `docs/Server-Architecture.md`
   - ❌ WRONG: `SERVER_ARCHITECTURE.md` (root level)
   - ❌ WRONG: `src/docs/guide.md` (inside src)
   
2. **Root-Level Exceptions**: Only these files are allowed in the project root:
   - `README.md` - Project overview and getting started
   - `LICENSE` - License file
   - `CHANGELOG.md` - Version history (if needed)
   
3. **Summary Documents**: 
   - ⚠️ **DO NOT** create summary documents unless explicitly requested by the user
   - User must specifically ask: "Create a summary of changes", "Document the migration", etc.
   - Most changes should be documented in existing files or commit messages
   - Only create summaries when the user specifically asks for one
   - If created, they MUST go in `docs/` directory with appropriate subdirectory

4. **When Creating Documentation**:
   - **Always** check if `docs/` directory exists
   - **Always** create new docs in `docs/`
   - Use subdirectories for organization: `docs/guides/`, `docs/api/`, `docs/migration/`, etc.
   - **Never** create documentation in the project root (except README.md)
   - **Ask first** before creating new documentation files

5. **Existing Root-Level Docs**: If you find documentation in the root:
   - Move it to `docs/` with appropriate subdirectory
   - Update any references to the old location
   - Notify the user of the move

### Documentation Organization

```
docs/
├── Home.md                    # Wiki home page
├── Server-Architecture.md     # Server architecture overview
├── WebSocket-API.md          # Socket.IO API reference
└── migration/                # Migration documentation (if needed)
```

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

- **Client**: SvelteKit app on Vercel (`uncharted-lands/client`)
- **Server**: Game server on Railway/Render (`uncharted-lands/server`)
- **Protocol**: Socket.IO with typed events
- **Database**: Shared PostgreSQL database
- **Health endpoint**: HTTP GET `/health` for monitoring

---

## Official Documentation References

### Socket.IO

- **Docs**: https://socket.io/docs/v4/
- **Server API**: https://socket.io/docs/v4/server-api/
- **TypeScript**: https://socket.io/docs/v4/typescript/
- **Emit cheatsheet**: https://socket.io/docs/v4/emit-cheatsheet/

### Drizzle ORM

- **Docs**: https://orm.drizzle.team/docs/overview
- **PostgreSQL**: https://orm.drizzle.team/docs/get-started-postgresql
- **Queries**: https://orm.drizzle.team/docs/rqb
- **Migrations**: https://orm.drizzle.team/docs/migrations

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
├── docs/
│   ├── Home.md                          # Wiki home page
│   ├── Server-Architecture.md           # Architecture documentation
│   └── WebSocket-API.md                 # Socket.IO API reference
├── src/
│   ├── db/
│   │   ├── index.ts                     # Database connection
│   │   ├── schema.ts                    # Drizzle schema definitions
│   │   ├── queries.ts                   # Query helper functions
│   │   └── README.md                    # Database usage guide
│   ├── events/
│   │   └── handlers.ts                  # Socket.IO event handlers
│   ├── game/
│   │   └── resource-calculator.ts       # Resource production logic
│   ├── middleware/
│   │   └── socket-middleware.ts         # Socket.IO middleware
│   ├── types/
│   │   └── socket-events.ts             # TypeScript event definitions
│   ├── utils/
│   │   └── logger.ts                    # Structured logging
│   └── index.ts                         # Main server entry point
├── drizzle/
│   ├── 0000_*.sql                       # Database migrations
│   └── meta/                            # Migration metadata
├── drizzle.config.ts                    # Drizzle configuration
├── .env.example                         # Environment variables template
├── .gitignore                           # Git ignore rules
├── eslint.config.js                     # ESLint configuration
├── package.json                         # Dependencies and scripts
├── .prettierrc                          # Code formatting
├── README.md                            # Project documentation
└── tsconfig.json                        # TypeScript configuration
```

### Key Files

- **src/index.ts**: Main server with:
  - Socket.IO server with typed events
  - HTTP server for health checks (`/health`)
  - Middleware pipeline (logging, auth, error handling)
  - Event handler registration
  - Graceful shutdown handling
  - Database connection management

- **src/db/schema.ts**: Complete database schema:
  - 14 tables (Account, Profile, Settlement, World, etc.)
  - Relations and foreign keys
  - TypeScript type exports
  - All game data structures

- **src/db/queries.ts**: Pre-built query helpers:
  - Authentication queries
  - Settlement operations
  - World/region queries
  - Resource management

- **src/events/handlers.ts**: Socket.IO event handlers:
  - Player authentication
  - World joining/leaving
  - Resource collection
  - Structure building
  - Game state synchronization

- **src/game/resource-calculator.ts**: Game logic:
  - Time-based resource production
  - Production rate calculations
  - Resource consumption
  - Net production calculations

- **.env**: Configuration (never commit!)
  - `PORT`: Server port (default: 3001)
  - `HOST`: Bind address (default: 0.0.0.0)
  - `DATABASE_URL`: PostgreSQL connection
  - `CORS_ORIGINS`: Allowed client origins
  - `SENTRY_DSN`: Error tracking (optional)

---

## Code Style Guidelines

### TypeScript Patterns

**Use ES Modules** (not CommonJS):

```typescript
// ✅ CORRECT
import { Server } from 'socket.io';
import { db } from './db/index.js';
export function broadcast(message: object) { }

// ❌ WRONG
const { Server } = require('socket.io');
const db = require('./db');
module.exports = { broadcast };
```

**Strict Type Safety**:

```typescript
// ✅ Explicit types
async function handleMessage(
  socket: Socket,
  data: CollectResourcesData
): Promise<void> {
  const settlement = await getSettlementWithDetails(data.settlementId);
}

// ❌ Implicit any
async function handleMessage(socket, data) {
  const settlement = await getSettlementWithDetails(data.settlementId);
}
```

**Use TypeScript Interfaces for Socket Events**:

```typescript
// ✅ Typed Socket.IO events
import type { 
  ClientToServerEvents,
  ServerToClientEvents
} from './types/socket-events';

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);
```

### Socket.IO Patterns

**Connection Handling**:

```typescript
io.on('connection', (socket) => {
  logger.info('[CONNECTION] Client connected', { socketId: socket.id });
  
  // Authentication check
  if (!socket.data.authenticated) {
    socket.disconnect();
    return;
  }
  
  // Register event handlers
  registerEventHandlers(socket);
  
  // Track connection
  socket.on('disconnect', (reason) => {
    logger.info('[DISCONNECT]', { socketId: socket.id, reason });
  });
});
```

**Event Handlers with Acknowledgments**:

```typescript
socket.on('collect-resources', async (data, callback) => {
  try {
    const result = await handleCollectResources(socket, data);
    callback({ success: true, data: result });
  } catch (error) {
    logger.error('[ERROR] Resource collection failed:', error);
    callback({ success: false, error: error.message });
  }
});
```

**Room-Based Broadcasting**:

```typescript
// Join world room
socket.join(`world:${worldId}`);

// Broadcast to specific world
io.to(`world:${worldId}`).emit('state-update', {
  type: 'resource-update',
  data: newResources
});

// Broadcast to all except sender
socket.to(`world:${worldId}`).emit('player-action', action);
```

**Error Handling**:

```typescript
socket.on('error', (error: Error) => {
  logger.error('[SOCKET ERROR]', { socketId: socket.id, error });
});

// Middleware error handling
io.use((socket, next) => {
  try {
    // Validation logic
    next();
  } catch (error) {
    next(new Error('Middleware error'));
  }
});
```

### Database Patterns (Drizzle ORM)

**Query with Relations**:

```typescript
import { db, settlements, settlementStorage, plots } from './db';
import { eq } from 'drizzle-orm';

const settlement = await db
  .select({
    settlement: settlements,
    storage: settlementStorage,
    plot: plots,
  })
  .from(settlements)
  .leftJoin(settlementStorage, eq(settlements.settlementStorageId, settlementStorage.id))
  .leftJoin(plots, eq(settlements.plotId, plots.id))
  .where(eq(settlements.id, settlementId))
  .limit(1);
```

**Insert with Returning**:

```typescript
const [newSettlement] = await db
  .insert(settlements)
  .values({
    id: generateId(),
    playerProfileId: profileId,
    plotId: plotId,
    settlementStorageId: storageId,
    name: 'New Settlement',
  })
  .returning();
```

**Update Resources**:

```typescript
const [updated] = await db
  .update(settlementStorage)
  .set({
    food: newAmount.food,
    water: newAmount.water,
  })
  .where(eq(settlementStorage.id, storageId))
  .returning();
```

---

## Event Protocol

### Client → Server Events

```typescript
// Authenticate
{
  type: 'authenticate',
  playerId: string,
  token: string
}

// Join world
{
  type: 'join-world',
  worldId: string,
  playerId: string
}

// Collect resources
{
  type: 'collect-resources',
  settlementId: string
}

// Build structure
{
  type: 'build-structure',
  settlementId: string,
  structureType: string,
  position: { x: number, y: number }
}
```

### Server → Client Events

```typescript
// Connected
{
  type: 'connected',
  message: string,
  socketId: string,
  timestamp: number
}

// Game state
{
  type: 'game-state',
  worldId: string,
  state: {
    settlements: Settlement[],
    playerId: string
  },
  timestamp: number
}

// Resource update
{
  type: 'resource-update',
  settlementId: string,
  resources: ResourceAmounts,
  production: ResourceAmounts,
  timestamp: number
}

// Error
{
  type: 'error',
  code: string,
  message: string,
  timestamp: number
}
```

---

## Common Tasks & Patterns

### Starting Development Server

```bash
npm run dev
```

Runs server with hot-reload using tsx watch mode on port 3001.

### Database Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Push schema changes directly (dev only)
npm run db:push

# View database in Drizzle Studio
npm run db:studio
```

### Testing Socket.IO Events

Use the client's test files or Socket.IO client directly:

```typescript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  
  socket.emit('authenticate', {
    playerId: 'player-123',
    token: 'auth-token'
  }, (response) => {
    console.log('Auth response:', response);
  });
});
```

### Adding New Event Handler

1. Define event types in `src/types/socket-events.ts`:

```typescript
export interface ClientToServerEvents {
  'new-event': (data: NewEventData, callback: ResponseCallback) => void;
}

export interface NewEventData {
  settlementId: string;
  action: string;
}
```

2. Implement handler in `src/events/handlers.ts`:

```typescript
export function handleNewEvent(socket: Socket, data: NewEventData): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // Validate
      if (!data.settlementId) {
        throw new Error('Settlement ID required');
      }
      
      // Database query
      const settlement = await getSettlementWithDetails(data.settlementId);
      
      // Business logic
      // ...
      
      // Respond
      socket.emit('new-event-response', { success: true });
      resolve();
    } catch (error) {
      logger.error('[NEW EVENT ERROR]', error);
      reject(error);
    }
  });
}
```

3. Register in `registerEventHandlers()`:

```typescript
socket.on('new-event', async (data, callback) => {
  try {
    await handleNewEvent(socket, data);
    callback?.({ success: true });
  } catch (error) {
    callback?.({ success: false, error: error.message });
  }
});
```

### Adding Database Query

1. Add query function to `src/db/queries.ts`:

```typescript
export async function getNewData(id: string) {
  try {
    const result = await db
      .select()
      .from(tableName)
      .where(eq(tableName.id, id))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    logger.error('[QUERY ERROR]', error);
    throw error;
  }
}
```

2. Export from `src/db/index.ts` if needed:

```typescript
export { getNewData } from './queries.js';
```

3. Use in handlers:

```typescript
import { getNewData } from '../db/index.js';

const data = await getNewData(id);
```

### Broadcasting Updates

```typescript
// Broadcast to specific world room
io.to(`world:${worldId}`).emit('state-update', {
  type: 'resource-update',
  data: newResources
});

// Broadcast to all except sender
socket.to(`world:${worldId}`).emit('player-action', action);

// Broadcast to specific player
io.to(socket.id).emit('personal-update', data);
```

### Health Check Endpoint

Already implemented in `src/index.ts`:

```typescript
// HTTP GET /health
// Returns: { status: 'ok', uptime: number, timestamp: number }
```

---

## Testing

### Manual Socket.IO Testing

Using Socket.IO client library:

```typescript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  
  // Test authentication
  socket.emit('authenticate', {
    playerId: 'test-player',
    token: 'test-token'
  }, (response) => {
    console.log('Auth response:', response);
  });
  
  // Test resource collection
  socket.emit('collect-resources', {
    settlementId: 'settlement-123'
  }, (response) => {
    console.log('Collect response:', response);
  });
});

socket.on('resource-update', (data) => {
  console.log('Resource update:', data);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

### Testing with Client

```typescript
// From SvelteKit client (src/lib/server/socket.ts)
const socket = io('ws://localhost:3001');

socket.on('connect', () => {
  socket.emit('authenticate', { playerId, token }, (response) => {
    if (response.success) {
      // Request game state
      socket.emit('game-state-request', { worldId }, (state) => {
        console.log('Game state:', state);
      });
    }
  });
});
```

### Health Check Testing

```powershell
# Test health endpoint
Invoke-WebRequest -Uri http://localhost:3001/health

# Expected response
{"status":"ok","uptime":123.456,"timestamp":1234567890}
```

---

## Do's and Don'ts

### ✅ DO

- Use ES modules (import/export)
- Type all function parameters and return values
- Use Socket.IO event acknowledgments for responses
- Clean up connections and rooms on disconnect
- Use Drizzle ORM for all database queries
- Log important events with Winston logger
- Implement health checks
- Support graceful shutdown (already implemented)
- Validate incoming event data
- Use environment variables for configuration
- Join/leave rooms properly for world-based broadcasting
- Use typed Socket.IO events (ClientToServerEvents, ServerToClientEvents)

### ❌ DON'T

- Don't use CommonJS (require/module.exports)
- Don't use `any` type without good reason
- Don't ignore Socket.IO errors
- Don't leave orphaned room subscriptions
- Don't send unstructured data (always use typed events)
- Don't log sensitive information (passwords, tokens)
- Don't hardcode configuration (use .env)
- Don't block the event loop with synchronous operations
- Don't trust client input without validation
- Don't commit `.env` files
- Don't use raw WebSocket (ws library) - we migrated to Socket.IO
- Don't query database without error handling

---

## Deployment

### Environment Variables

Required environment variables in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Server
PORT=3001
NODE_ENV=production

# Logging
LOG_LEVEL=info
```

### Railway/Render Configuration

**Build Command**:
```bash
npm install && npm run build
```

**Start Command**:
```bash
npm start
```

**Health Check Endpoint**:
```
http://server-url:3001/health
```

Returns: `{ status: 'ok', uptime: number, timestamp: number }`

### Production Considerations

1. **Connection Pooling**: Already configured with 10 max connections in `src/db/index.ts`
2. **Graceful Shutdown**: Implemented in `src/index.ts` (closes database, Socket.IO server)
3. **Error Logging**: Winston logger with structured logs
4. **Database Connections**: Automatically closed on SIGTERM/SIGINT
5. **Socket.IO Rooms**: Memory-based, no Redis needed yet (scale later with Redis adapter)
6. **CORS**: Configure for production domains
7. **Rate Limiting**: Consider implementing for authentication endpoints

---

## Useful Commands

```powershell
# Development
npm run dev              # Start dev server with auto-reload (tsx watch)
npm run build            # Build TypeScript to dist/
npm start                # Run production build (node dist/index.js)

# Database
npm run db:generate      # Generate Drizzle migration from schema changes
npm run db:push          # Push schema changes directly to database (dev only)
npm run db:studio        # Open Drizzle Studio web UI

# Code Quality
npm run type-check       # TypeScript type checking (if configured)
npm run lint             # ESLint code checking (if configured)

# Package Management
npm install              # Install dependencies
npm update               # Update dependencies
npm audit                # Check for vulnerabilities

# Testing
npm test                 # Run tests (if configured)
```

---

## Current Migration Status

### ✅ Completed

**Phase 1: Drizzle ORM Setup**
- Installed Drizzle ORM, postgres driver, drizzle-kit
- Converted Prisma schema to Drizzle (14 tables)
- Generated and applied migrations
- Fixed PostgreSQL float underflow (real → doublePrecision)
- Created database connection with pooling
- Built query helper library (15+ functions)

**Phase 2: Socket.IO Implementation**
- Migrated from native WebSocket (ws) to Socket.IO
- Implemented typed event system (ClientToServerEvents, ServerToClientEvents)
- Created middleware pipeline (authentication, logging, error handling)
- Built authentication with real database token validation
- Implemented settlement resource collection
- Created resource calculator system
- Added game state request handler

**Phase 3: Server Architecture**
- Server running on port 3001
- HTTP health endpoint (/health)
- Winston logging with structured logs
- Graceful shutdown handling
- Connection pooling (10 max connections)
- Database cleanup on shutdown

### 🔄 In Progress

**Phase 4: Game Mechanics**
- Build structure handler (TODO)
- 60Hz game loop for automatic resource generation (TODO)
- World generation server-side (TODO)
- Population and consumption system (TODO)

**Phase 5: Client Integration**
- Client still using Prisma for direct database access
- Need to migrate all client queries to use Socket.IO events
- Remove Prisma from client after migration complete

### 📋 Implementation Reference

Key files to reference when continuing migration:

1. **Database**:
   - `src/db/schema.ts` - Complete Drizzle schema (14 tables)
   - `src/db/queries.ts` - Pre-built query functions
   - `src/db/README.md` - Database usage guide

2. **Socket.IO**:
   - `src/types/socket-events.ts` - Typed event definitions
   - `src/middleware/socket-middleware.ts` - Authentication, logging, error handling
   - `src/events/handlers.ts` - Event handler implementations

3. **Game Logic**:
   - `src/game/resource-calculator.ts` - Production/consumption calculations

4. **Documentation**:
   - `DRIZZLE_MIGRATION_PLAN.md` - Full migration strategy
   - `MIGRATION_PROGRESS.md` - Detailed progress report
   - `NEXT_STEPS.md` - Quick start for next phase

---

## Additional Resources

### Socket.IO
- Official Docs: https://socket.io/docs/v4/
- TypeScript Support: https://socket.io/docs/v4/typescript/
- Server API: https://socket.io/docs/v4/server-api/

### Drizzle ORM
- Documentation: https://orm.drizzle.team/docs/overview
- PostgreSQL Guide: https://orm.drizzle.team/docs/get-started-postgresql
- Drizzle Kit: https://orm.drizzle.team/kit-docs/overview

### Node.js
- Node.js Docs: https://nodejs.org/docs/
- Best Practices: https://github.com/goldbergyoni/nodebestpractices

### TypeScript
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- Advanced Types: https://www.typescriptlang.org/docs/handbook/2/types-from-types.html

### Deployment
- Railway Docs: https://docs.railway.app/
- Render Docs: https://render.com/docs

---

## Questions or Unsure?

1. **Check Socket.IO docs**: https://socket.io/docs/v4/
2. **Review Drizzle docs**: https://orm.drizzle.team/docs/
3. **Check existing implementations**: See `src/events/handlers.ts` for patterns
4. **Review migration docs**: See `DRIZZLE_MIGRATION_PLAN.md` and `MIGRATION_PROGRESS.md`
5. **Ask the team** - Don't make assumptions!

---

**Last Updated**: January 2025  
**Status**: Drizzle migration complete, Socket.IO implemented, game mechanics in progress  
**Tech Stack**: TypeScript + Socket.IO + Drizzle ORM + PostgreSQL + Node.js 22.x  
**Deployment**: Railway/Render with persistent connections

````