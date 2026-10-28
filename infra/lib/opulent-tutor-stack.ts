import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as triggers from 'aws-cdk-lib/triggers';
import type { Construct } from 'constructs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

export interface OpulentTutorStackProps extends cdk.StackProps {
  stage: string;
  auth0Domain: string;
  auth0Audience: string;
  auth0ClientId: string;
  corsOrigin: string;
  webOrigin: string;
  emailFrom: string;
  resendApiKey: string;
  alarmEmail: string;
}

const repoRoot = path.join(__dirname, '..', '..');

export class OpulentTutorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OpulentTutorStackProps) {
    super(scope, id, props);

    const isProd = props.stage === 'prod';

    // Network

    // One NAT, not one per AZ: a second costs about 32 USD a month for redundancy the MVP does not need.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: isProd ? 1 : 1,
    });

    // Database

    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_6,
      }),
      // t4g.micro is roughly 12 USD a month and is enough for the MVP.
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE4_GRAVITON,
        isProd ? ec2.InstanceSize.SMALL : ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      databaseName: 'opulent_tutor',
      credentials: rds.Credentials.fromGeneratedSecret('opulent'),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(isProd ? 14 : 1),
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    /** RDS Proxy keeps one shared Postgres pool, so a traffic spike cannot exhaust the database with per-copy connections. */
    const dbProxy = database.addProxy('DbProxy', {
      vpc,
      secrets: [database.secret!],
      requireTLS: true,
      // Prepared statements must be disabled in the client when pinning is off.
      borrowTimeout: cdk.Duration.seconds(30),
      maxConnectionsPercent: 90,
    });

    /** No DATABASE_URL with a password: that would put it in the CloudFormation template and the Lambda console, so compute assembles it from Secrets Manager. */
    const proxyDatabaseEnvironment = {
      DB_SECRET_ARN: database.secret!.secretArn,
      DB_HOST: dbProxy.endpoint,
      DB_NAME: 'opulent_tutor',
      DB_PORT: '5432',
    };
    // One long job does not need the proxy, and the proxy blocks session locks the migrator uses.
    const directDatabaseEnvironment = {
      ...proxyDatabaseEnvironment,
      DB_HOST: database.instanceEndpoint.hostname,
    };

    // API: the whole backend in one Lambda function

    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'lambda.handler',
      // Built by `pnpm --filter @opulent/api run build` before deploying.
      code: lambda.Code.fromAsset(path.join(repoRoot, 'apps', 'api', 'dist')),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      memorySize: 512,
      timeout: cdk.Duration.seconds(20),
      logRetention: logs.RetentionDays.TWO_WEEKS,
      environment: {
        NODE_ENV: 'production',
        ...proxyDatabaseEnvironment,
        AUTH0_DOMAIN: props.auth0Domain,
        AUTH0_AUDIENCE: props.auth0Audience,
        CORS_ORIGIN: props.corsOrigin,
        WEB_ORIGIN: props.webOrigin,
        // Empty mail settings stay off the function, so a dev deploy does not try to send.
        ...(props.emailFrom ? { EMAIL_FROM: props.emailFrom } : {}),
        ...(props.resendApiKey ? { RESEND_API_KEY: props.resendApiKey } : {}),
      },
    });

    dbProxy.grantConnect(apiFunction, 'opulent');
    dbProxy.connections.allowFrom(apiFunction, ec2.Port.tcp(5432));
    database.secret!.grantRead(apiFunction);

    const migrationsHash = createHash('sha256')
      .update(
        readFileSync(path.join(repoRoot, 'packages', 'db', 'migrations', 'meta', '_journal.json')),
      )
      .digest('hex')
      .slice(0, 16);

    const migrateSecurityGroup = new ec2.SecurityGroup(this, 'MigrateSecurityGroup', {
      vpc,
      description: 'Schema migration on deploy',
    });
    database.connections.allowFrom(migrateSecurityGroup, ec2.Port.tcp(5432), 'schema migration');

    const migrateFunction = new nodejs.NodejsFunction(this, 'MigrateFunction', {
      entry: path.join(repoRoot, 'packages', 'db', 'src', 'migrate-aws.ts'),
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, 'pnpm-lock.yaml'),
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [migrateSecurityGroup],
      memorySize: 512,
      timeout: cdk.Duration.minutes(5),
      logRetention: logs.RetentionDays.TWO_WEEKS,
      environment: {
        ...directDatabaseEnvironment,
        MIGRATIONS_HASH: migrationsHash,
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir, outputDir) => [
            `cp -R "${inputDir}/packages/db/migrations" "${outputDir}/migrations"`,
          ],
        },
      },
    });
    database.secret!.grantRead(migrateFunction);

    const migrateOnDeploy = new triggers.Trigger(this, 'MigrateOnDeploy', {
      handler: migrateFunction,
      timeout: cdk.Duration.minutes(5),
    });
    apiFunction.node.addDependency(migrateOnDeploy);

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `opulent-tutor-${props.stage}`,
      corsPreflight: {
        allowOrigins: props.corsOrigin.split(','),
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: cdk.Duration.days(1),
      },
      defaultIntegration: new apigwv2Integrations.HttpLambdaIntegration(
        'ApiIntegration',
        apiFunction,
      ),
      createDefaultStage: false,
    });

    // One throttle for the whole API. A per-user limit would need another store.
    httpApi.addStage('DefaultStage', {
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 20, burstLimit: 50 },
    });

    // Nightly Scryfall mirror refresh

    const cluster = new ecs.Cluster(this, 'JobsCluster', { vpc });

    /** Fargate, not Lambda: a 100,000-card download and upsert runs past Lambda's 15 minute ceiling. */
    const cardSyncTask = new ecs.FargateTaskDefinition(this, 'CardSyncTask', {
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    cardSyncTask.addContainer('card-sync', {
      image: ecs.ContainerImage.fromAsset(repoRoot, {
        file: path.join('jobs', 'card-sync', 'Dockerfile'),
        exclude: [
          'cdk.out',
          'infra/cdk.out',
          'node_modules',
          '**/node_modules',
          '.git',
          '.env',
          '.env.*',
          '**/dist',
          'coverage',
          'playwright-report',
          'test-results',
        ],
      }),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'card-sync',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
      environment: {
        ...directDatabaseEnvironment,
        SCRYFALL_BULK_TYPE: 'all_cards',
        // Scryfall requires an accurate User-Agent on every request.
        SCRYFALL_USER_AGENT: 'OpulentTutor/0.1 (+https://opulenttutor.com)',
      },
    });

    database.secret!.grantRead(cardSyncTask.taskRole);

    // The batch writer connects straight to the instance: one long-lived connection gains nothing from the proxy.
    const cardSyncSecurityGroup = new ec2.SecurityGroup(this, 'CardSyncSecurityGroup', {
      vpc,
      description: 'Nightly Scryfall mirror refresh task',
    });
    database.connections.allowFrom(cardSyncSecurityGroup, ec2.Port.tcp(5432), 'card sync task');

    // Scryfall rebuilds its bulk files in the evening UTC, so 06:00 UTC is safely after a fresh file.
    const cardSyncRule = new events.Rule(this, 'CardSyncSchedule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '6' }),
      targets: [
        new targets.EcsTask({
          cluster,
          taskDefinition: cardSyncTask,
          subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          securityGroups: [cardSyncSecurityGroup],
        }),
      ],
    });

    const alarmTopic = new sns.Topic(this, 'AlarmTopic');
    if (props.alarmEmail) {
      alarmTopic.addSubscription(new subscriptions.EmailSubscription(props.alarmEmail));
    }
    const alarmAction = new cloudwatchActions.SnsAction(alarmTopic);

    const apiErrors = new cloudwatch.Alarm(this, 'ApiErrors', {
      metric: apiFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'The API Lambda returned an error',
    });
    apiErrors.addAlarmAction(alarmAction);

    const dbStorage = new cloudwatch.Alarm(this, 'DbStorage', {
      metric: database.metricFreeStorageSpace({ period: cdk.Duration.minutes(15) }),
      threshold: 2 * 1024 * 1024 * 1024,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Database free storage is under 2 GB',
    });
    dbStorage.addAlarmAction(alarmAction);

    const cardSyncFailed = new cloudwatch.Alarm(this, 'CardSyncFailed', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Events',
        metricName: 'FailedInvocations',
        dimensionsMap: { RuleName: cardSyncRule.ruleName },
        statistic: 'Sum',
        period: cdk.Duration.hours(1),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'The nightly card sync did not start',
    });
    cardSyncFailed.addAlarmAction(alarmAction);

    // A container that exits non-zero does not count as a failed schedule invocation.
    new events.Rule(this, 'CardSyncTaskFailed', {
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Task State Change'],
        detail: {
          clusterArn: [cluster.clusterArn],
          lastStatus: ['STOPPED'],
          containers: { exitCode: [{ 'anything-but': 0 }] },
        },
      },
      targets: [new targets.SnsTopic(alarmTopic)],
    });

    // Web: static React build on S3, served through CloudFront

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    const webOrigin = origins.S3BucketOrigin.withOriginAccessControl(webBucket);
    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultBehavior: {
        origin: webOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/config.json': {
          origin: webOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      },
      defaultRootObject: 'index.html',
      // Single-page app: unknown paths must still load index.html so client routing takes over.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    new s3deploy.BucketDeployment(this, 'WebDeploy', {
      sources: [
        s3deploy.Source.asset(path.join(repoRoot, 'apps', 'web', 'dist')),
        s3deploy.Source.jsonData('config.json', {
          auth0Domain: props.auth0Domain,
          auth0ClientId: props.auth0ClientId,
          auth0Audience: props.auth0Audience,
          apiBaseUrl: httpApi.apiEndpoint,
        }),
      ],
      destinationBucket: webBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    // Outputs

    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'WebUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'WebBucketName', { value: webBucket.bucketName });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: database.secret!.secretArn });
  }
}
