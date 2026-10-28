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

if (resources.some((resource) => resource.Type === 'AWS::RDS::DBProxy')) {
  failures.push('the stack still has a database proxy');
}

const taskDefinitions = resources.filter(
  (resource) => resource.Type === 'AWS::ECS::TaskDefinition',
);
const cardSyncHost = JSON.stringify(taskDefinitions);
if (!cardSyncHost.includes('Endpoint.Address')) {
  failures.push('the card sync task must use the database instance address');
}
if (!cardSyncHost.includes('ARM64')) {
  failures.push('the card sync task must use the ARM processor');
}

const apiFunctions = resources.filter(
  (resource) => resource.Type === 'AWS::Lambda::Function' && resource.id.includes('ApiFunction'),
);
const apiJson = JSON.stringify(apiFunctions);
if (!apiJson.includes('Endpoint.Address')) {
  failures.push('the API Lambda must use the database instance address');
}
if (!apiJson.includes('WEB_ORIGIN')) failures.push('the API Lambda is missing WEB_ORIGIN');
if (!apiJson.includes('arm64')) failures.push('the API Lambda must use the ARM processor');
if (!apiJson.includes('1024')) failures.push('the API Lambda must use 1024 MB');
if (!apiJson.includes('ReservedConcurrentExecutions')) {
  failures.push('the API Lambda is missing a concurrency cap');
}

if (failures.length > 0) {
  throw new Error(failures.join('\n'));
}

console.log(`template check passed (${files.length} templates)`);
