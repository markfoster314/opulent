#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { OpulentTutorStack } from '../lib/opulent-tutor-stack';

const app = new cdk.App();

const stage = String(app.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev');

new OpulentTutorStack(app, `OpulentTutor-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  // Set these per stage before the first deploy.
  auth0Domain: String(app.node.tryGetContext('auth0Domain') ?? 'your-tenant.us.auth0.com'),
  auth0Audience: String(app.node.tryGetContext('auth0Audience') ?? 'https://api.opulenttutor.com'),
  corsOrigin: String(app.node.tryGetContext('corsOrigin') ?? 'http://localhost:5173'),
});

app.synth();
