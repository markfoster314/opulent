export interface StageSettings {
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

const PLACEHOLDER_DOMAIN = 'your-tenant.us.auth0.com';
const PLACEHOLDER_CLIENT = 'your-spa-client-id';
const DEV_AUDIENCE = 'https://api.opulenttutor.com';
const DEV_ORIGIN = 'http://localhost:5173';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Dev keeps the laptop defaults. Prod must be given real values or synth stops. */
export function resolveStageSettings(stage: string, read: (key: string) => unknown): StageSettings {
  const auth0Domain = text(read('auth0Domain')) || PLACEHOLDER_DOMAIN;
  const auth0Audience = text(read('auth0Audience')) || DEV_AUDIENCE;
  const auth0ClientId = text(read('auth0ClientId')) || PLACEHOLDER_CLIENT;
  const corsOrigin = text(read('corsOrigin')) || DEV_ORIGIN;
  const emailFrom = text(read('emailFrom'));
  const resendApiKey = text(read('resendApiKey'));
  const alarmEmail = text(read('alarmEmail'));
  const webOrigin = text(read('webOrigin')) || corsOrigin.split(',')[0]?.trim() || DEV_ORIGIN;

  if (stage === 'prod') {
    const missing: string[] = [];
    if (auth0Domain === PLACEHOLDER_DOMAIN) missing.push('auth0Domain');
    if (!text(read('auth0Audience'))) missing.push('auth0Audience');
    if (auth0ClientId === PLACEHOLDER_CLIENT) missing.push('auth0ClientId');
    if (!text(read('corsOrigin')) || corsOrigin.includes('localhost')) missing.push('corsOrigin');
    const webOriginMissing =
      !text(read('webOrigin')) ||
      webOrigin.includes('localhost') ||
      !webOrigin.startsWith('https://');
    if (webOriginMissing) missing.push('webOrigin');
    if (!emailFrom) missing.push('emailFrom');
    if (!resendApiKey) missing.push('resendApiKey');
    if (missing.length > 0) {
      throw new Error(`Prod deploy is missing ${missing.join(', ')}`);
    }
  }

  return {
    stage,
    auth0Domain,
    auth0Audience,
    auth0ClientId,
    corsOrigin,
    webOrigin,
    emailFrom,
    resendApiKey,
    alarmEmail,
  };
}
