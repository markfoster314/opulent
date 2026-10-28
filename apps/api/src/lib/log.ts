import pino from 'pino';

const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

function level(): (typeof levels)[number] {
  const chosen = process.env.LOG_LEVEL;
  if (chosen && (levels as readonly string[]).includes(chosen)) {
    return chosen as (typeof levels)[number];
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/** JSON on stdout. Lambda sends that stream to CloudWatch. */
export const log = pino({
  level: level(),
  redact: ['req.headers.authorization', 'authorization', 'email', '*.email'],
});

export function redactEmails(value: string): string {
  return value.replace(/[^\s@]+@[^\s@]+/g, '[redacted]');
}

export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown';
  return redactEmails(message);
}
