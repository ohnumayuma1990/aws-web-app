import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const TABLE_NAME = process.env.TABLE_NAME!;
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface Card {
    suit: string;
    value: string;
}

interface Player {
    connectionId: string;
    score: number;
    hand: Card[];
}

interface GameState {
    deck: Card[];
    field: Card[];
    currentTurnIndex: number;
    turnStartTime: number;
    status: 'waiting' | 'playing' | 'ended';
    winnerId?: string;
}

// Helper function to initialize a deck
const createDeck = (): Card[] => {
    const suits = ['♠', '♣', '♦', '♥'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

// Helper function to send messages back to the client
const sendMessageToClient = async (domainName: string, stage: string, connectionId: string, message: any) => {
    const apiGwClient = new ApiGatewayManagementApiClient({
        endpoint: `https://${domainName}/${stage}`
    });
    try {
        await apiGwClient.send(new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: new TextEncoder().encode(JSON.stringify(message))
        }));
    } catch (e: any) {
        if (e.statusCode === 410) {
            console.log(`Found stale connection, deleting ${connectionId}`);
            await docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { PK: `CONN#${connectionId}`, SK: `CONN#${connectionId}` }
            }));
        } else {
            console.error("Failed to post to connection", e);
        }
    }
};

export const handler: APIGatewayProxyHandler = async (event) => {
    const { requestContext, body } = event;
    const connectionId = requestContext.connectionId!;
    const domainName = requestContext.domainName!;
    const stage = requestContext.stage!;
    const routeKey = requestContext.routeKey!;

    console.log(`Received routeKey: ${routeKey}`);

    try {
        if (routeKey === "$connect") {
            // Save connection
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: `CONN#${connectionId}`,
                    SK: `CONN#${connectionId}`,
                    type: "Connection",
                    createdAt: Date.now()
                }
            }));
            return { statusCode: 200, body: "Connected." };

        } else if (routeKey === "$disconnect") {
            // Retrieve connection info to find if user is in a room
            const connResponse = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: `CONN#${connectionId}`, SK: `CONN#${connectionId}` }
            }));

            const roomId = connResponse.Item?.roomId;

            // Delete connection
            await docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { PK: `CONN#${connectionId}`, SK: `CONN#${connectionId}` }
            }));

            // Remove connection from room
            if (roomId) {
                await docClient.send(new DeleteCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` }
                }));

                // Notify others in room
                const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));

                const connections = usersResponse.Items || [];
                await Promise.all(connections.map(conn => {
                    const otherConnectionId = conn.SK.replace('CONN#', '');
                    return sendMessageToClient(domainName, stage, otherConnectionId, {
                        action: "userLeft",
                        connectionId: connectionId,
                        roomId: roomId
                    });
                }));
            }
            return { statusCode: 200, body: "Disconnected." };
        } else {
            // Handle custom actions
            if (!body) return { statusCode: 400, body: "Missing body." };
            const payload = JSON.parse(body);
            const action = payload.action;

            if (action === "createRoom") {
                const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                const isPrivate = payload.isPrivate || false;

                // Add room
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `ROOM#${roomId}`,
                        SK: `ROOM#${roomId}`,
                        type: "Room",
                        createdAt: Date.now(),
                        isPrivate: isPrivate,
                        gameState: {
                            deck: [],
                            field: [],
                            currentTurnIndex: 0,
                            turnStartTime: 0,
                            status: 'waiting'
                        }
                    }
                }));

                // Add user to room
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `ROOM#${roomId}`,
                        SK: `CONN#${connectionId}`,
                        type: "RoomConnection",
                        score: 0,
                        hand: []
                    }
                }));

                // Update user with room
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `CONN#${connectionId}`, SK: `CONN#${connectionId}` },
                    UpdateExpression: "SET roomId = :roomId",
                    ExpressionAttributeValues: { ":roomId": roomId }
                }));

                await sendMessageToClient(domainName, stage, connectionId, {
                    action: "roomCreated",
                    roomId: roomId,
                    users: [connectionId]
                });

            } else if (action === "joinRoom") {
                const roomId = payload.roomId;

                // Add user to room
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `ROOM#${roomId}`,
                        SK: `CONN#${connectionId}`,
                        type: "RoomConnection",
                        score: 0,
                        hand: []
                    }
                }));

                // Update user with room
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `CONN#${connectionId}`, SK: `CONN#${connectionId}` },
                    UpdateExpression: "SET roomId = :roomId",
                    ExpressionAttributeValues: { ":roomId": roomId }
                }));

                // Notify others in room
                const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));

                const connections = usersResponse.Items || [];
                const roomConnections = connections.map(c => c.SK.replace('CONN#', ''));

                await Promise.all(connections.map(conn => {
                    const otherConnectionId = conn.SK.replace('CONN#', '');
                    if (otherConnectionId !== connectionId) {
                        return sendMessageToClient(domainName, stage, otherConnectionId, {
                            action: "userJoined",
                            connectionId: connectionId,
                            roomId: roomId
                        });
                    }
                    return Promise.resolve();
                }));

                await sendMessageToClient(domainName, stage, connectionId, {
                    action: "roomJoined",
                    roomId: roomId,
                    users: roomConnections
                });

            } else if (action === "searchRooms") {
                const response = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    IndexName: "TypeIndex",
                    KeyConditionExpression: "#type = :type",
                    FilterExpression: "isPrivate = :isPrivate",
                    ExpressionAttributeNames: { "#type": "type" },
                    ExpressionAttributeValues: {
                        ":type": "Room",
                        ":isPrivate": false
                    },
                    ScanIndexForward: false, // newest first
                    Limit: 10
                }));

                const rooms = response.Items || [];
                await sendMessageToClient(domainName, stage, connectionId, {
                    action: "roomsList",
                    rooms: rooms.map(r => ({ roomId: r.PK.replace('ROOM#', ''), createdAt: r.createdAt }))
                });

            } else if (action === "leaveRoom") {
                const roomId = payload.roomId;

                await docClient.send(new DeleteCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` }
                }));

                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `CONN#${connectionId}`, SK: `CONN#${connectionId}` },
                    UpdateExpression: "REMOVE roomId"
                }));

                // Notify others in room
                const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));

                const connections = usersResponse.Items || [];
                await Promise.all(connections.map(conn => {
                    const otherConnectionId = conn.SK.replace('CONN#', '');
                    return sendMessageToClient(domainName, stage, otherConnectionId, {
                        action: "userLeft",
                        connectionId: connectionId,
                        roomId: roomId
                    });
                }));

                await sendMessageToClient(domainName, stage, connectionId, {
                    action: "leftRoom",
                    roomId: roomId
                });

            } else if (action === "startGame") {
                const roomId = payload.roomId;
                const deck = createDeck();

                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `ROOM#${roomId}` },
                    UpdateExpression: "SET gameState = :gs",
                    ExpressionAttributeValues: {
                        ":gs": {
                            deck: deck,
                            field: [],
                            currentTurnIndex: 0,
                            turnStartTime: Date.now(),
                            status: 'playing'
                        }
                    }
                }));

                const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));
                const connections = usersResponse.Items || [];

                await Promise.all(connections.map(conn => {
                    const cid = conn.SK.replace('CONN#', '');
                    return sendMessageToClient(domainName, stage, cid, {
                        action: "gameStarted",
                        gameState: {
                            field: [],
                            currentTurnIndex: 0,
                            turnStartTime: Date.now(),
                            status: 'playing',
                            deckCount: deck.length
                        },
                        players: connections.map(c => c.SK.replace('CONN#', ''))
                    });
                }));

            } else if (action === "drawCard") {
                const roomId = payload.roomId;

                const roomResponse = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `ROOM#${roomId}` }
                }));
                const room = roomResponse.Item;
                if (!room || room.gameState.status !== 'playing') return { statusCode: 400, body: "Invalid game state" };

                const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));
                const connections = usersResponse.Items || [];
                const currentPlayerId = connections[room.gameState.currentTurnIndex].SK.replace('CONN#', '');

                if (currentPlayerId !== connectionId) return { statusCode: 403, body: "Not your turn" };

                const deck = room.gameState.deck as Card[];
                if (deck.length === 0) return { statusCode: 400, body: "Deck empty" };

                const card = deck.pop();

                // Update room deck
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `ROOM#${roomId}` },
                    UpdateExpression: "SET gameState.deck = :deck",
                    ExpressionAttributeValues: { ":deck": deck }
                }));

                // Update player hand
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` },
                    UpdateExpression: "SET hand = list_append(hand, :card)",
                    ExpressionAttributeValues: { ":card": [card] }
                }));

                // Notify all
                await Promise.all(connections.map(conn => {
                    const cid = conn.SK.replace('CONN#', '');
                    return sendMessageToClient(domainName, stage, cid, {
                        action: "cardDrawn",
                        connectionId: connectionId,
                        deckCount: deck.length,
                        card: cid === connectionId ? card : null // Only show card to drawer
                    });
                }));

            } else if (action === "playCard") {
                const { roomId, cardIndex } = payload;

                const roomResponse = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `ROOM#${roomId}` }
                }));
                const room = roomResponse.Item;
                if (!room || room.gameState.status !== 'playing') return { statusCode: 400, body: "Invalid game state" };

                const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));
                const connections = usersResponse.Items || [];
                const currentPlayerId = connections[room.gameState.currentTurnIndex].SK.replace('CONN#', '');

                if (currentPlayerId !== connectionId) return { statusCode: 403, body: "Not your turn" };

                const playerResponse = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` }
                }));
                const player = playerResponse.Item;
                if (!player || !player.hand[cardIndex]) return { statusCode: 400, body: "Invalid card index" };

                const card = player.hand[cardIndex];
                player.hand.splice(cardIndex, 1);

                // Update player hand
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` },
                    UpdateExpression: "SET hand = :hand",
                    ExpressionAttributeValues: { ":hand": player.hand }
                }));

                // Update field and next turn
                const nextTurnIndex = (room.gameState.currentTurnIndex + 1) % connections.length;
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `ROOM#${roomId}` },
                    UpdateExpression: "SET gameState.field = list_append(gameState.field, :card), gameState.currentTurnIndex = :nextTurn, gameState.turnStartTime = :startTime",
                    ExpressionAttributeValues: {
                        ":card": [card],
                        ":nextTurn": nextTurnIndex,
                        ":startTime": Date.now()
                    }
                }));

                // Notify all
                await Promise.all(connections.map(conn => {
                    const cid = conn.SK.replace('CONN#', '');
                    return sendMessageToClient(domainName, stage, cid, {
                        action: "cardPlayed",
                        connectionId: connectionId,
                        card: card,
                        nextTurnIndex: nextTurnIndex,
                        turnStartTime: Date.now()
                    });
                }));

            } else if (action === "selectCard") {
                const { roomId, cardIndex } = payload;
                // Broadcast selection for visual feedback
                 const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));
                const connections = usersResponse.Items || [];
                await Promise.all(connections.map(conn => {
                    const cid = conn.SK.replace('CONN#', '');
                    return sendMessageToClient(domainName, stage, cid, {
                        action: "cardSelected",
                        connectionId: connectionId,
                        cardIndex: cardIndex
                    });
                }));

            } else if (action === "actOnCard") {
                const { roomId, cardIndex } = payload;
                // Simple action: gain 10 points
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` },
                    UpdateExpression: "SET score = score + :inc",
                    ExpressionAttributeValues: { ":inc": 10 }
                }));

                const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));
                const connections = usersResponse.Items || [];

                // Check victory condition (e.g., 100 points)
                const playerResponse = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` }
                }));
                const score = playerResponse.Item?.score;
                let winnerId = null;
                if (score >= 100) {
                    winnerId = connectionId;
                    await docClient.send(new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: { PK: `ROOM#${roomId}`, SK: `ROOM#${roomId}` },
                        UpdateExpression: "SET gameState.status = :status, gameState.winnerId = :winnerId",
                        ExpressionAttributeValues: { ":status": 'ended', ":winnerId": winnerId }
                    }));
                }

                await Promise.all(connections.map(conn => {
                    const cid = conn.SK.replace('CONN#', '');
                    return sendMessageToClient(domainName, stage, cid, {
                        action: "scoreUpdated",
                        connectionId: connectionId,
                        score: score,
                        winnerId: winnerId
                    });
                }));

            } else if (action === "resetGame") {
                const roomId = payload.roomId;
                // Reset scores and game state
                const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));
                const connections = usersResponse.Items || [];
                await Promise.all(connections.map(conn => {
                    return docClient.send(new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: { PK: `ROOM#${roomId}`, SK: conn.SK },
                        UpdateExpression: "SET score = :zero, hand = :empty",
                        ExpressionAttributeValues: { ":zero": 0, ":empty": [] }
                    }));
                }));

                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: `ROOM#${roomId}`, SK: `ROOM#${roomId}` },
                    UpdateExpression: "SET gameState = :gs",
                    ExpressionAttributeValues: {
                        ":gs": {
                            deck: [],
                            field: [],
                            currentTurnIndex: 0,
                            turnStartTime: 0,
                            status: 'waiting'
                        }
                    }
                }));

                await Promise.all(connections.map(conn => {
                    const cid = conn.SK.replace('CONN#', '');
                    return sendMessageToClient(domainName, stage, cid, {
                        action: "gameReset"
                    });
                }));

            } else if (action === "sendMessage") {
                const message = payload.message;
                const roomId = payload.roomId;

                const usersResponse = await docClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": `ROOM#${roomId}`,
                        ":skPrefix": "CONN#"
                    }
                }));

                const connections = usersResponse.Items || [];
                await Promise.all(connections.map(conn => {
                    const otherConnectionId = conn.SK.replace('CONN#', '');
                    if (otherConnectionId !== connectionId) {
                        return sendMessageToClient(domainName, stage, otherConnectionId, {
                            action: "messageReceived",
                            from: connectionId,
                            message: message
                        });
                    }
                    return Promise.resolve();
                }));
            } else {
                return { statusCode: 400, body: "Unknown action" };
            }

            return { statusCode: 200, body: "Action processed." };
        }

    } catch (err: any) {
        console.error("Error", err);
        return { statusCode: 500, body: err.message };
    }
};