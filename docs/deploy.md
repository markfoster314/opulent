# Deploy

Production is one stack, `OpulentTutor-prod`, in `us-east-1`. One Lambda, one Postgres host, one NAT, CloudFront. Auth0 stays outside AWS.

Dev stays on local Postgres. Do not leave a second stack running.

## First deploy

AWS CLI credentials for the account. CDK bootstrap once per account and region:

```bash
pnpm --filter @opulent/infra exec cdk bootstrap aws://ACCOUNT/us-east-1
```

Then:

```bash
pnpm build
pnpm --filter @opulent/infra run deploy -- \
  --context stage=prod \
  --context auth0Domain=... \
  --context auth0Audience=... \
  --context auth0ClientId=... \
  --context corsOrigin=... \
  --context webOrigin=https://... \
  --context emailFrom=... \
  --context resendApiKey=... \
  --context alarmEmail=...
```

`alarmEmail` is optional. `pnpm build` first. Deploy applies the schema and uploads `apps/web/dist`. The site reads `/config.json` for the API address and the Auth0 settings.

| Context         | Rule                                      |
| --------------- | ----------------------------------------- |
| `auth0Domain`   | Auth0 tenant host                         |
| `auth0Audience` | API identifier                            |
| `auth0ClientId` | SPA client id                             |
| `corsOrigin`    | Site origin allowed to call the API       |
| `webOrigin`     | `https://` site origin used in mail links |
| `emailFrom`     | From address                              |
| `resendApiKey`  | Resend key                                |
| `alarmEmail`    | Optional alarm inbox                      |

The card image is `linux/arm64`. An x86 machine needs Docker Buildx and QEMU. An ARM machine does not.

## GitHub

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) deploys after the [CI](../.github/workflows/ci.yml) workflow succeeds on a push to `main`. It can also be run with **Run workflow**.

The job checks out that commit, installs, builds, and runs `cdk deploy --require-approval never`. The web build uses placeholder `VITE_` values. The live site reads `/config.json`.

### AWS role

1. Bootstrap, as above.
2. IAM identity provider `https://token.actions.githubusercontent.com`. Audience `sts.amazonaws.com`.
3. Role trusted only for this repo's `production` environment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:markfoster314/opulent:environment:production"
        }
      }
    }
  ]
}
```

4. Let that role assume the CDK bootstrap roles (`cdk-hnb659fds-deploy-role-*`, `cdk-hnb659fds-file-publishing-role-*`, `cdk-hnb659fds-image-publishing-role-*`, `cdk-hnb659fds-lookup-role-*`). On a single-purpose account, `AdministratorAccess` is the short path.

### GitHub environment

Settings → Environments → `production`.

Variable:

| Name                  | Value                 |
| --------------------- | --------------------- |
| `AWS_DEPLOY_ROLE_ARN` | ARN of the role above |

Secrets:

| Name              | Maps to                |
| ----------------- | ---------------------- |
| `AUTH0_DOMAIN`    | `auth0Domain`          |
| `AUTH0_AUDIENCE`  | `auth0Audience`        |
| `AUTH0_CLIENT_ID` | `auth0ClientId`        |
| `CORS_ORIGIN`     | `corsOrigin`           |
| `WEB_ORIGIN`      | `webOrigin`            |
| `EMAIL_FROM`      | `emailFrom`            |
| `RESEND_API_KEY`  | `resendApiKey`         |
| `ALARM_EMAIL`     | `alarmEmail`, optional |

Region is `us-east-1` in the workflow. The account id comes from the assumed role.

Create the environment and the role before the first green push to `main`. Until then, use the first-deploy command.
