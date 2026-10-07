import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import * as path from 'node:path';

export interface OpulentTutorStackProps extends cdk.StackProps {
  stage: string;
  auth0Domain: string;
  auth0Audience: string;
  corsOrigin: string;
}

const repoRoot = path.join(__dirname, '..', '..');

export class OpulentTutorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OpulentTutorStackProps) {
    super(scope, id, props);

    const isProd = props.stage === 'prod';

    // ---------------------------------------------------------------------
    // Network
    // ---------------------------------------------------------------------

    // One NAT gateway, not one per availability zone. A second NAT costs about
    // 32 USD a month and buys redundancy the MVP does not need yet.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: isProd ? 1 : 1,
    });

    // ---------------------------------------------------------------------
    // Database
    // ---------------------------------------------------------------------

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

    /**
     * Amazon RDS Proxy. Without it, every warm Lambda copy holds its own
     * Postgres connection and a traffic spike exhausts the database. The proxy
     * keeps one shared pool and hands connections out.
     */
    const dbProxy = database.addProxy('DbProxy', {
      vpc,
      secrets: [database.secret!],
      requireTLS: true,
      // Prepared statements must be disabled in the client when pinning is off.
      borrowTimeout: cdk.Duration.seconds(30),
      maxConnectionsPercent: 90,
    });

    /**
     * Note what is NOT here: a DATABASE_URL containing the password.
     *
     * Putting it in an environment variable would place the plaintext password
     * in the CloudFormation template and in the Lambda console. Instead the
     * compute gets the secret ARN and the proxy host, and assembles the
     * connection string at runtime from AWS Secrets Manager.
     */
    const databaseEnvironment = {
      DB_SECRET_ARN: database.secret!.secretArn,
      DB_HOST: dbProxy.endpoint,
      DB_NAME: 'opulent_tutor',
      DB_PORT: '5432',
    };

    // ---------------------------------------------------------------------
    // API: the whole backend in one Lambda function
    // ---------------------------------------------------------------------

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
        ...databaseEnvironment,
        AUTH0_DOMAIN: props.auth0Domain,
        AUTH0_AUDIENCE: props.auth0Audience,
        CORS_ORIGIN: props.corsOrigin,
      },
    });

    dbProxy.grantConnect(apiFunction, 'opulent');
    dbProxy.connections.allowDefaultPortFrom(apiFunction);
    database.secret!.grantRead(apiFunction);

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
    });

    // ---------------------------------------------------------------------
    // Nightly Scryfall mirror refresh
    // ---------------------------------------------------------------------

    const cluster = new ecs.Cluster(this, 'JobsCluster', { vpc });

    /**
     * This runs on Fargate rather than Lambda because downloading and upserting
     * roughly 100,000 cards takes longer than Lambda's 15 minute ceiling.
     */
    const cardSyncTask = new ecs.FargateTaskDefinition(this, 'CardSyncTask', {
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    cardSyncTask.addContainer('card-sync', {
      image: ecs.ContainerImage.fromAsset(repoRoot, {
        file: path.join('jobs', 'card-sync', 'Dockerfile'),
      }),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'card-sync',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
      environment: {
        ...databaseEnvironment,
        SCRYFALL_BULK_TYPE: 'default_cards',
        // Scryfall requires an accurate User-Agent on every request.
        SCRYFALL_USER_AGENT: 'OpulentTutor/0.1 (+https://opulenttutor.com)',
      },
    });

    database.secret!.grantRead(cardSyncTask.taskRole);

    // The batch writer connects straight to the instance rather than through
    // the proxy: it is one long-lived connection, which is exactly the case the
    // proxy adds no value to.
    const cardSyncSecurityGroup = new ec2.SecurityGroup(this, 'CardSyncSecurityGroup', {
      vpc,
      description: 'Nightly Scryfall mirror refresh task',
    });
    database.connections.allowDefaultPortFrom(cardSyncSecurityGroup, 'card sync task');

    // Scryfall rebuilds its bulk files in the evening UTC, so 06:00 UTC is
    // comfortably after a fresh file exists.
    new events.Rule(this, 'CardSyncSchedule', {
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

    // ---------------------------------------------------------------------
    // Web: static React build on S3, served through CloudFront
    // ---------------------------------------------------------------------

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      // Single-page app: every unknown path must still load index.html so
      // client-side routing can take over.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // ---------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------

    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'WebUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'WebBucketName', { value: webBucket.bucketName });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: database.secret!.secretArn });
  }
}
