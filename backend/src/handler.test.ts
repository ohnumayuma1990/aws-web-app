import { handler } from "./handler";
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { mockClient } from "aws-sdk-client-mock";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const ddbMock = mockClient(DynamoDBDocumentClient);
const apiGwMock = mockClient(ApiGatewayManagementApiClient);

describe("handler", () => {
    beforeEach(() => {
        ddbMock.reset();
        apiGwMock.reset();
        process.env.TABLE_NAME = "TestTable";
        process.env.AWS_REGION = "us-east-1";
    });

    it("should handle $connect correctly", async () => {
        ddbMock.on(PutCommand).resolves({});

        const event = {
            requestContext: {
                routeKey: "$connect",
                connectionId: "test-conn-id",
                domainName: "test.com",
                stage: "prod"
            }
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event, {} as any, () => {}) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(200);
        expect(result.body).toBe("Connected.");
        expect(ddbMock.commandCalls(PutCommand).length).toBe(1);
    });

    it("should handle $disconnect correctly", async () => {
        ddbMock.on(GetCommand).resolves({ Item: { roomId: "ROOM1" } });
        ddbMock.on(DeleteCommand).resolves({});
        ddbMock.on(QueryCommand).resolves({ Items: [{ SK: "CONN#other-id" }] });
        apiGwMock.on(PostToConnectionCommand).resolves({});

        const event = {
            requestContext: {
                routeKey: "$disconnect",
                connectionId: "test-conn-id",
                domainName: "test.com",
                stage: "prod"
            }
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event, {} as any, () => {}) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(200);
        expect(ddbMock.commandCalls(DeleteCommand).length).toBe(2); // Connection and RoomConnection
        expect(apiGwMock.commandCalls(PostToConnectionCommand).length).toBe(1);
    });

    it("should handle createRoom action correctly", async () => {
        ddbMock.on(PutCommand).resolves({});
        ddbMock.on(UpdateCommand).resolves({});
        apiGwMock.on(PostToConnectionCommand).resolves({});

        const event = {
            requestContext: {
                routeKey: "$default",
                connectionId: "test-conn-id",
                domainName: "test.com",
                stage: "prod"
            },
            body: JSON.stringify({ action: "createRoom" })
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event, {} as any, () => {}) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(200);
        expect(ddbMock.commandCalls(PutCommand).length).toBe(2); // Room and RoomConnection
        expect(apiGwMock.commandCalls(PostToConnectionCommand).length).toBe(1);
    });

    it("should handle joinRoom action correctly", async () => {
        ddbMock.on(PutCommand).resolves({});
        ddbMock.on(UpdateCommand).resolves({});
        ddbMock.on(QueryCommand).resolves({ Items: [{ SK: "CONN#user1" }, { SK: "CONN#user2" }] });
        apiGwMock.on(PostToConnectionCommand).resolves({});

        const event = {
            requestContext: {
                routeKey: "$default",
                connectionId: "test-conn-id",
                domainName: "test.com",
                stage: "prod"
            },
            body: JSON.stringify({ action: "joinRoom", roomId: "ROOM123" })
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event, {} as any, () => {}) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(200);
        expect(ddbMock.commandCalls(PutCommand).length).toBe(1);
        expect(ddbMock.commandCalls(UpdateCommand).length).toBe(1);
        expect(apiGwMock.commandCalls(PostToConnectionCommand).length).toBe(3); // 2 others + 1 for self
    });

    it("should handle sendMessage action correctly", async () => {
        ddbMock.on(QueryCommand).resolves({ Items: [{ SK: "CONN#user1" }, { SK: "CONN#test-conn-id" }] });
        apiGwMock.on(PostToConnectionCommand).resolves({});

        const event = {
            requestContext: {
                routeKey: "$default",
                connectionId: "test-conn-id",
                domainName: "test.com",
                stage: "prod"
            },
            body: JSON.stringify({ action: "sendMessage", roomId: "ROOM123", message: "hello" })
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event, {} as any, () => {}) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(200);
        expect(apiGwMock.commandCalls(PostToConnectionCommand).length).toBe(1); // Only to user1
    });

    it("should return 400 for unknown action", async () => {
        const event = {
            requestContext: {
                routeKey: "$default",
                connectionId: "test-conn-id",
                domainName: "test.com",
                stage: "prod"
            },
            body: JSON.stringify({ action: "unknown" })
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event, {} as any, () => {}) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(400);
        expect(result.body).toBe("Unknown action");
    });
});
