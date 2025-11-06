import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

// Store clients by channel
const channels = new Map<string, Set<WebSocket>>();

// Create HTTP server for CORS and WebSocket upgrade
const server = createServer((req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server running');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');

  // Send welcome message
  ws.send(JSON.stringify({
    type: "system",
    message: "Please join a channel to start chatting",
  }));

  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`\n=== Received message from client ===`);
      console.log(`Type: ${data.type}, Channel: ${data.channel || 'N/A'}`);
      if (data.message?.command) {
        console.log(`Command: ${data.message.command}, ID: ${data.id}`);
      } else if (data.message?.result) {
        console.log(`Response: ID: ${data.id}, Has Result: ${!!data.message.result}`);
      }
      console.log(`Full message:`, JSON.stringify(data, null, 2));

      if (data.type === "join") {
        const channelName = data.channel;
        if (!channelName || typeof channelName !== "string") {
          ws.send(JSON.stringify({
            type: "error",
            message: "Channel name is required"
          }));
          return;
        }

        // Create channel if it doesn't exist
        if (!channels.has(channelName)) {
          channels.set(channelName, new Set());
        }

        // Add client to channel
        const channelClients = channels.get(channelName)!;
        channelClients.add(ws);

        console.log(`\n✓ Client joined channel "${channelName}" (${channelClients.size} total clients)`);

        // Notify client they joined successfully
        ws.send(JSON.stringify({
          type: "system",
          message: `Joined channel: ${channelName}`,
          channel: channelName
        }));

        ws.send(JSON.stringify({
          type: "system",
          message: {
            id: data.id,
            result: "Connected to channel: " + channelName,
          },
          channel: channelName
        }));

        // Notify other clients in channel
        channelClients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "system",
              message: "A new user has joined the channel",
              channel: channelName
            }));
          }
        });
        return;
      }

      // Handle regular messages
      if (data.type === "message" || data.type === "progress_update") {
        const channelName = data.channel;
        if (!channelName || typeof channelName !== "string") {
          ws.send(JSON.stringify({
            type: "error",
            message: "Channel name is required"
          }));
          return;
        }

        const channelClients = channels.get(channelName);
        if (!channelClients || !channelClients.has(ws)) {
          ws.send(JSON.stringify({
            type: "error",
            message: "You must join the channel first"
          }));
          return;
        }

        // Broadcast to all OTHER clients in the channel (not the sender)
        let broadcastCount = 0;
        channelClients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            broadcastCount++;
            const broadcastMessage = {
              type: "broadcast",
              message: data.message,
              sender: "peer",
              channel: channelName
            };
            console.log(`\n=== Broadcasting to peer #${broadcastCount} ===`);
            console.log(JSON.stringify(broadcastMessage, null, 2));
            client.send(JSON.stringify(broadcastMessage));
          }
        });

        if (broadcastCount === 0) {
          console.log(`⚠️  No other clients in channel "${channelName}" to receive message!`);
        } else {
          console.log(`✓ Broadcast to ${broadcastCount} peer(s) in channel "${channelName}"`);
        }
      }
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');

    // Remove client from all channels
    channels.forEach((clients, channelName) => {
      if (clients.has(ws)) {
        clients.delete(ws);

        // Notify other clients in same channel
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "system",
              message: "A user has left the channel",
              channel: channelName
            }));
          }
        });
      }
    });
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = 3055;
const HOST = '0.0.0.0'; // Allow connections from any interface

server.listen(PORT, HOST, () => {
  console.log(`WebSocket server running on ${HOST}:${PORT}`);
  console.log(`ws://localhost:${PORT}`);
});
