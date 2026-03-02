import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';

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

    // WebSocket API
    const webSocketApi = new apigwv2.CfnApi(this, 'GameWebSocketApi', {
      name: 'ServerlessGameWebSocketApi',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    new cdk.CfnOutput(this, 'WebSocketApiEndpoint', {
      value: `${webSocketApi.attrApiEndpoint}`,
      description: 'The endpoint for the WebSocket API',
    });
  }
}