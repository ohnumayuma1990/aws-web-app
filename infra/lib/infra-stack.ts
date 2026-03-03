import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigwv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table for Rooms and Users
    const gameTable = new dynamodb.Table(this, 'GameTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Free tier friendly
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev purposes
    });

    // Add GSI for searching public rooms
    gameTable.addGlobalSecondaryIndex({
      indexName: 'TypeIndex',
      partitionKey: { name: 'type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Lambda Function
    const backendLambda = new nodejs.NodejsFunction(this, 'GameBackendFunction', {
      entry: path.join(__dirname, '../../backend/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        TABLE_NAME: gameTable.tableName,
      },
    });

    // Grant DynamoDB access
    gameTable.grantReadWriteData(backendLambda);

    // WebSocket API Gateway
    const webSocketApi = new apigwv2.WebSocketApi(this, 'ServerlessGameWebSocketApi', {
      apiName: 'ServerlessGameWebSocketApi',
      routeSelectionExpression: '$request.body.action',
    });

    // Add permissions to lambda to send messages to websocket clients
    webSocketApi.grantManageConnections(backendLambda);

    const integration = new WebSocketLambdaIntegration('BackendIntegration', backendLambda);

    // Routes
    webSocketApi.addRoute('$connect', {
      integration: integration,
    });
    webSocketApi.addRoute('$disconnect', {
      integration: integration,
    });
    webSocketApi.addRoute('createRoom', {
      integration: integration,
    });
    webSocketApi.addRoute('joinRoom', {
      integration: integration,
    });
    webSocketApi.addRoute('sendMessage', {
      integration: integration,
    });
    webSocketApi.addRoute('searchRooms', {
      integration: integration,
    });
    webSocketApi.addRoute('leaveRoom', {
      integration: integration,
    });
    webSocketApi.addRoute('startGame', {
      integration: integration,
    });
    webSocketApi.addRoute('drawCard', {
      integration: integration,
    });
    webSocketApi.addRoute('playCard', {
      integration: integration,
    });
    webSocketApi.addRoute('selectCard', {
      integration: integration,
    });
    webSocketApi.addRoute('actOnCard', {
      integration: integration,
    });
    webSocketApi.addRoute('resetGame', {
      integration: integration,
    });
    webSocketApi.addRoute('$default', {
      integration: integration,
    });

    const webSocketStage = new apigwv2.WebSocketStage(this, 'GameStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    new cdk.CfnOutput(this, 'WebSocketApiEndpoint', {
      value: webSocketStage.url,
      description: 'The endpoint for the WebSocket API',
    });
  }
}