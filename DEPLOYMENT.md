# Quick Deployment Reference

## 🚀 Deploy to Fly.io

```bash
# First time setup
fly auth login
fly launch

# Subsequent deployments
fly deploy

# Monitor
fly logs
fly status
```

## 📋 Pre-Deployment Checklist

```bash
# From server/ directory
npm run type-check  # ✅ Check TypeScript
npm run lint        # ✅ Check code quality
npm run build       # ✅ Verify build works
npm test           # ✅ Run tests (when added)
```

## 🔧 Environment Variables

```bash
fly secrets set DATABASE_URL="your_database_url"
fly secrets set SENTRY_DSN="your_sentry_dsn"
```

## 🏥 Health Check

```bash
# After deployment
curl https://uncharted-lands-server.fly.dev/health
```

Expected:
```json
{
  "status": "healthy",
  "uptime": 12345.678,
  "timestamp": "2025-11-06T10:30:00.000Z"
}
```

## 🔌 WebSocket Connection

```javascript
// Client connection
const ws = new WebSocket('wss://uncharted-lands-server.fly.dev');

ws.addEventListener('open', () => {
  console.log('Connected to server');
});

ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
});
```

## 📊 Monitoring

```bash
fly logs              # Real-time logs
fly logs -n 100       # Last 100 lines
fly status            # App status
fly machine list      # Machine info
```

## 🔄 Scaling

```bash
fly scale count 2           # 2 instances
fly scale vm shared-cpu-2x  # Upgrade VM
fly scale memory 512        # 512MB RAM
```

## 🐛 Troubleshooting

```bash
fly logs --level error  # Show errors
fly ssh console         # SSH into machine
fly machine restart     # Restart
```

## 📚 Full Documentation

See [FLY_DEPLOYMENT.md](./FLY_DEPLOYMENT.md) for complete guide.
