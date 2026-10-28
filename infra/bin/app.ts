#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { OpulentTutorStack } from '../lib/opulent-tutor-stack';
import { resolveStageSettings } from '../lib/stage-context';

const app = new cdk.App();

const stage = String(app.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev');
const settings = resolveStageSettings(stage, (key) => app.node.tryGetContext(key));

new OpulentTutorStack(app, `OpulentTutor-${stage}`, {
  ...settings,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});

app.synth();
