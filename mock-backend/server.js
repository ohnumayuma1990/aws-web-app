const WebSocket = require('ws');
const crypto = require('crypto');

const wss = new WebSocket.Server({ port: 8080 });

// State
const connections = new Map(); // connectionId -> { ws, roomId }
const rooms = new Map(); // roomId -> Set of connectionIds

function sendMessageToClient(connectionId, message) {
    const client = connections.get(connectionId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
    }
}

wss.on('connection', (ws) => {
    const connectionId = crypto.randomUUID();
    connections.set(connectionId, { ws, roomId: null });
    console.log(`[CONNECT] ${connectionId}`);

    ws.on('message', (message) => {
        let payload;
        try {
            payload = JSON.parse(message);
        } catch (e) {
            console.error('Failed to parse message', message);
            return;
        }

        const action = payload.action;
        const clientState = connections.get(connectionId);

        if (action === 'createRoom') {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            clientState.roomId = roomId;
            rooms.set(roomId, new Set([connectionId]));
            console.log(`[CREATE ROOM] ${roomId} by ${connectionId}`);

            sendMessageToClient(connectionId, {
                action: "roomCreated",
                roomId: roomId
            });

        } else if (action === 'joinRoom') {
            const roomId = payload.roomId;
            clientState.roomId = roomId;

            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
            }

            const roomUsers = rooms.get(roomId);
            roomUsers.add(connectionId);

            console.log(`[JOIN ROOM] ${connectionId} joined ${roomId}`);

            // Notify others
            for (const otherConnectionId of roomUsers) {
                if (otherConnectionId !== connectionId) {
                    sendMessageToClient(otherConnectionId, {
                        action: "userJoined",
                        connectionId: connectionId,
                        roomId: roomId
                    });
                }
            }

            sendMessageToClient(connectionId, {
                action: "roomJoined",
                roomId: roomId,
                users: Array.from(roomUsers)
            });

        } else if (action === 'sendMessage') {
            const roomId = payload.roomId;
            const msg = payload.message;

            const roomUsers = rooms.get(roomId);
            if (roomUsers) {
                for (const otherConnectionId of roomUsers) {
                    if (otherConnectionId !== connectionId) {
                        sendMessageToClient(otherConnectionId, {
                            action: "messageReceived",
                            from: connectionId,
                            message: msg,
                            timestamp: payload.timestamp // Pass through timestamp for latency measurement
                        });
                    }
                }
            }
        }
    });

    ws.on('close', () => {
        console.log(`[DISCONNECT] ${connectionId}`);
        const clientState = connections.get(connectionId);

        if (clientState && clientState.roomId) {
            const roomId = clientState.roomId;
            const roomUsers = rooms.get(roomId);

            if (roomUsers) {
                roomUsers.delete(connectionId);
                for (const otherConnectionId of roomUsers) {
                    sendMessageToClient(otherConnectionId, {
                        action: "userLeft",
                        connectionId: connectionId,
                        roomId: roomId
                    });
                }
                if (roomUsers.size === 0) {
                    rooms.delete(roomId);
                }
            }
        }
        connections.delete(connectionId);
    });
});

console.log('Mock WebSocket server is running on ws://localhost:8080');
