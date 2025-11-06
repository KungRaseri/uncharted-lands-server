import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Track connected clients
const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket, req) => {
  console.log(`New client connected from ${req.socket.remoteAddress}`);
  clients.add(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Welcome to Uncharted Lands Server',
    timestamp: Date.now()
  }));

  // Handle incoming messages
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message:', message);

      // Echo back for now (implement game logic here)
      ws.send(JSON.stringify({
        type: 'echo',
        data: message,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error parsing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast message to all connected clients
export function broadcast(message: object): void {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Start server
server.listen(PORT, HOST, () => {
  console.log(`WebSocket server running on ws://${HOST}:${PORT}`);
  console.log(`Health check available at http://${HOST}:${PORT}/health`);
  console.log(`Connected clients: ${clients.size}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  wss.clients.forEach((client) => {
    client.close(1000, 'Server shutting down');
  });
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
