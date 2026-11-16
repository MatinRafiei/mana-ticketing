const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const db = require('./server/db');
const pushService = require('./server/push');
const superadminRoutes = require('./server/routes/superadmin');
const apiRoutes = require('./server/routes/api');

const app = express();
const server = http.createServer(app);

// WebSocket Server for live instant updates (<50ms)
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

function broadcastWs(data) {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(message);
      } catch (err) {
        console.warn('WebSocket send error:', err);
      }
    }
  }
}

// Inject broadcast to API router
apiRoutes.setBroadcast(broadcastWs);

// Express Middlewares
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API routes
app.use('/api/superadmin', superadminRoutes);
app.use('/api', apiRoutes);

// Static frontend files
app.use(express.static(path.join(__dirname)));

// Fallback route for SPA navigation
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log(`🚀 سامانه تیکتینگ مانا روی پورت ${PORT} آماده به کار است.`);
  console.log(`🌐 آدرس وب‌اپلیکیشن:  http://localhost:${PORT}`);
  console.log(`🔐 پنل مدیریت ارشد:   http://localhost:${PORT}/superadmin.html`);
  console.log(`👤 کاربر سوپرادمین:   superadmin`);
  console.log(`🔑 رمز پیش‌فرض:       admin123456`);
  console.log('==================================================');
});
