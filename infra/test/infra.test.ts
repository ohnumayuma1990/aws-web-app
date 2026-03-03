import { describe, test } from '@jest/globals';
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as Infra from '../lib/infra-stack';

describe('InfraStack', () => {
  test('DynamoDB Table Created', () => {
    const app = new cdk.App();
    const stack = new Infra.InfraStack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: Match.arrayWith([
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' }
      ])
    });
  });

  test('Lambda Function Created with Environment Variables', () => {
    const app = new cdk.App();
    const stack = new Infra.InfraStack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs20.x',
      Environment: {
        Variables: {
          TABLE_NAME: Match.anyValue()
        }
      }
    });
  });

  test('WebSocket API Created', () => {
    const app = new cdk.App();
    const stack = new Infra.InfraStack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      Name: 'ServerlessGameWebSocketApi',
      ProtocolType: 'WEBSOCKET',
      RouteSelectionExpression: '$request.body.action'
    });
  });
});
