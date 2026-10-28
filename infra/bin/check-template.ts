import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface TemplateResource {
  Type: string;
  Properties?: Record<string, unknown>;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'cdk.out');
const files = readdirSync(outDir).filter((name) => name.endsWith('.template.json'));
if (files.length === 0) {
  throw new Error('No CloudFormation template. Run pnpm infra:synth first.');
}

const resources = files.flatMap((name) => {
  const template = JSON.parse(readFileSync(join(outDir, name), 'utf8')) as {
    Resources?: Record<string, TemplateResource>;
  };
  return Object.entries(template.Resources ?? {}).map(([id, resource]) => ({ id, ...resource }));
});

const failures: string[] = [];

const alarms = resources.filter((resource) => resource.Type === 'AWS::CloudWatch::Alarm');
if (alarms.length < 3) failures.push(`expected at least 3 alarms, found ${alarms.length}`);

if (!resources.some((resource) => resource.id.includes('MigrateFunction'))) {
  failures.push('expected a migrate function');
}

if (!resources.some((resource) => resource.Type === 'Custom::CDKBucketDeployment')) {
  failures.push('expected the web bucket deployment');
}

const taskDefinitions = resources.filter(
  (resource) => resource.Type === 'AWS::ECS::TaskDefinition',
);
const cardSyncHost = JSON.stringify(taskDefinitions);
if (!cardSyncHost.includes('Endpoint.Address')) {
  failures.push('the card sync task must use the database instance address');
}
if (cardSyncHost.includes('DbProxy')) {
  failures.push('the card sync task still points at the database proxy');
}

const functions = resources.filter((resource) => resource.Type === 'AWS::Lambda::Function');
const apiEnv = JSON.stringify(functions);
if (!apiEnv.includes('WEB_ORIGIN')) failures.push('the API Lambda is missing WEB_ORIGIN');

if (failures.length > 0) {
  throw new Error(failures.join('\n'));
}

console.log(`template check passed (${files.length} templates)`);
