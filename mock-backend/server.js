const WebSocket = require('ws');
const crypto = require('crypto');

const wss = new WebSocket.Server({ port: 8080 });

// State
const connections = new Map(); // connectionId -> { ws, roomId, hand, score }
const rooms = new Map(); // roomId -> { users: Set, gameState, isPrivate, createdAt }

function createDeck() {
    const suits = ['♠', '♣', '♦', '♥'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function sendMessageToClient(connectionId, message) {
    const client = connections.get(connectionId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
    }
}

wss.on('connection', (ws) => {
    const connectionId = crypto.randomUUID();
    connections.set(connectionId, { ws, roomId: null, hand: [], score: 0 });
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
            rooms.set(roomId, {
                users: new Set([connectionId]),
                gameState: {
                    deck: [],
                    field: [],
                    currentTurnIndex: 0,
                    turnStartTime: 0,
                    status: 'waiting'
                },
                isPrivate: payload.isPrivate || false,
                createdAt: Date.now()
            });
            console.log(`[CREATE ROOM] ${roomId} by ${connectionId}`);

            sendMessageToClient(connectionId, {
                action: "roomCreated",
                roomId: roomId,
                users: [connectionId]
            });

        } else if (action === 'joinRoom') {
            const roomId = payload.roomId;
            clientState.roomId = roomId;

            if (!rooms.has(roomId)) {
                rooms.set(roomId, {
                    users: new Set(),
                    gameState: { deck: [], field: [], currentTurnIndex: 0, turnStartTime: 0, status: 'waiting' },
                    isPrivate: false,
                    createdAt: Date.now()
                });
            }

            const room = rooms.get(roomId);
            room.users.add(connectionId);

            console.log(`[JOIN ROOM] ${connectionId} joined ${roomId}`);

            // Notify others
            for (const otherConnectionId of room.users) {
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
                users: Array.from(room.users)
            });

        } else if (action === 'searchRooms') {
            const publicRooms = [];
            for (const [rid, r] of rooms.entries()) {
                if (!r.isPrivate) {
                    publicRooms.push({ roomId: rid, createdAt: r.createdAt });
                }
            }
            sendMessageToClient(connectionId, {
                action: "roomsList",
                rooms: publicRooms.sort((a, b) => b.createdAt - a.createdAt).slice(0, 10)
            });

        } else if (action === 'leaveRoom') {
            const roomId = payload.roomId;
            const room = rooms.get(roomId);
            if (room) {
                room.users.delete(connectionId);
                for (const otherId of room.users) {
                    sendMessageToClient(otherId, {
                        action: "userLeft",
                        connectionId: connectionId,
                        roomId: roomId
                    });
                }
                if (room.users.size === 0) rooms.delete(roomId);
            }
            clientState.roomId = null;
            sendMessageToClient(connectionId, { action: "leftRoom", roomId });

        } else if (action === 'startGame') {
            const roomId = payload.roomId;
            const room = rooms.get(roomId);
            if (room) {
                room.gameState.deck = createDeck();
                room.gameState.status = 'playing';
                room.gameState.turnStartTime = Date.now();
                room.gameState.currentTurnIndex = 0;

                const userArray = Array.from(room.users);
                for (const cid of room.users) {
                    const c = connections.get(cid);
                    c.hand = [];
                    c.score = 0;
                    sendMessageToClient(cid, {
                        action: "gameStarted",
                        gameState: {
                            field: [],
                            currentTurnIndex: 0,
                            turnStartTime: room.gameState.turnStartTime,
                            status: 'playing',
                            deckCount: room.gameState.deck.length
                        },
                        players: userArray
                    });
                }
            }

        } else if (action === 'drawCard') {
            const roomId = payload.roomId;
            const room = rooms.get(roomId);
            if (room && room.gameState.deck.length > 0) {
                const card = room.gameState.deck.pop();
                clientState.hand.push(card);
                for (const cid of room.users) {
                    sendMessageToClient(cid, {
                        action: "cardDrawn",
                        connectionId: connectionId,
                        deckCount: room.gameState.deck.length,
                        card: cid === connectionId ? card : null
                    });
                }
            }

        } else if (action === 'playCard') {
            const { roomId, cardIndex } = payload;
            const room = rooms.get(roomId);
            if (room) {
                const card = clientState.hand.splice(cardIndex, 1)[0];
                room.gameState.field.push(card);
                room.gameState.currentTurnIndex = (room.gameState.currentTurnIndex + 1) % room.users.size;
                room.gameState.turnStartTime = Date.now();
                for (const cid of room.users) {
                    sendMessageToClient(cid, {
                        action: "cardPlayed",
                        connectionId: connectionId,
                        card: card,
                        nextTurnIndex: room.gameState.currentTurnIndex,
                        turnStartTime: room.gameState.turnStartTime
                    });
                }
            }

        } else if (action === 'actOnCard') {
            const { roomId } = payload;
            const room = rooms.get(roomId);
            if (room) {
                clientState.score += 10;
                let winnerId = clientState.score >= 100 ? connectionId : null;
                if (winnerId) room.gameState.status = 'ended';
                for (const cid of room.users) {
                    sendMessageToClient(cid, {
                        action: "scoreUpdated",
                        connectionId: connectionId,
                        score: clientState.score,
                        winnerId: winnerId
                    });
                }
            }

        } else if (action === 'resetGame') {
            const roomId = payload.roomId;
            const room = rooms.get(roomId);
            if (room) {
                room.gameState.status = 'waiting';
                room.gameState.field = [];
                for (const cid of room.users) {
                    const c = connections.get(cid);
                    c.score = 0;
                    c.hand = [];
                    sendMessageToClient(cid, { action: "gameReset" });
                }
            }

        } else if (action === 'sendMessage') {
            const roomId = payload.roomId;
            const msg = payload.message;

            const room = rooms.get(roomId);
            if (room) {
                for (const otherConnectionId of room.users) {
                    if (otherConnectionId !== connectionId) {
                        sendMessageToClient(otherConnectionId, {
                            action: "messageReceived",
                            from: connectionId,
                            message: msg
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
            const room = rooms.get(roomId);

            if (room) {
                room.users.delete(connectionId);
                for (const otherConnectionId of room.users) {
                    sendMessageToClient(otherConnectionId, {
                        action: "userLeft",
                        connectionId: connectionId,
                        roomId: roomId
                    });
                }
                if (room.users.size === 0) {
                    rooms.delete(roomId);
                }
            }
        }
        connections.delete(connectionId);
    });
});

console.log('Mock WebSocket server is running on ws://localhost:8080');
