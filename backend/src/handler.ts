import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const TABLE_NAME = process.env.TABLE_NAME!;
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

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
                for (const conn of connections) {
                    const otherConnectionId = conn.SK.replace('CONN#', '');
                    await sendMessageToClient(domainName, stage, otherConnectionId, {
                        action: "userLeft",
                        connectionId: connectionId,
                        roomId: roomId
                    });
                }
            }
            return { statusCode: 200, body: "Disconnected." };
        } else {
            // Handle custom actions
            if (!body) return { statusCode: 400, body: "Missing body." };
            const payload = JSON.parse(body);
            const action = payload.action;

            if (action === "createRoom") {
                const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

                // Add room
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `ROOM#${roomId}`,
                        SK: `ROOM#${roomId}`,
                        type: "Room",
                        createdAt: Date.now()
                    }
                }));

                // Add user to room
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `ROOM#${roomId}`,
                        SK: `CONN#${connectionId}`,
                        type: "RoomConnection"
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
                    roomId: roomId
                });

            } else if (action === "joinRoom") {
                const roomId = payload.roomId;

                // Add user to room
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `ROOM#${roomId}`,
                        SK: `CONN#${connectionId}`,
                        type: "RoomConnection"
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

                for (const conn of connections) {
                    const otherConnectionId = conn.SK.replace('CONN#', '');
                    if (otherConnectionId !== connectionId) {
                         await sendMessageToClient(domainName, stage, otherConnectionId, {
                            action: "userJoined",
                            connectionId: connectionId,
                            roomId: roomId
                        });
                    }
                }

                await sendMessageToClient(domainName, stage, connectionId, {
                    action: "roomJoined",
                    roomId: roomId,
                    users: roomConnections
                });

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
                for (const conn of connections) {
                    const otherConnectionId = conn.SK.replace('CONN#', '');
                    if (otherConnectionId !== connectionId) {
                        await sendMessageToClient(domainName, stage, otherConnectionId, {
                            action: "messageReceived",
                            from: connectionId,
                            message: message
                        });
                    }
                }
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