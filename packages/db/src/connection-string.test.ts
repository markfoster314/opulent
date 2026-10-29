import { afterEach, describe, expect, it, vi } from 'vitest';
import { awsDatabaseUrl, postgresSsl } from './connection-string';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalSecretArn = process.env.DB_SECRET_ARN;
const originalHost = process.env.DB_HOST;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalSecretArn === undefined) delete process.env.DB_SECRET_ARN;
  else process.env.DB_SECRET_ARN = originalSecretArn;
  if (originalHost === undefined) delete process.env.DB_HOST;
  else process.env.DB_HOST = originalHost;
  vi.resetModules();
});

describe('awsDatabaseUrl', () => {
  it('asks the client to verify the server certificate', () => {
    const url = awsDatabaseUrl({
      username: 'opulent',
      password: 'p@ss word',
      host: 'db.example.rds.amazonaws.com',
      port: '5432',
      database: 'opulent_tutor',
    });
    expect(url).toContain(encodeURIComponent('p@ss word'));
    const parsed = new URL(url);
    expect(decodeURIComponent(parsed.password)).toBe('p@ss word');
    expect(parsed.searchParams.get('sslmode')).toBe('verify-full');
    expect(parsed.hostname).toBe('db.example.rds.amazonaws.com');
  });
});

describe('postgresSsl', () => {
  it('attaches the RDS certificate only for verify-full', () => {
    const remote = postgresSsl(
      'postgresql://opulent:secret@db.example.rds.amazonaws.com:5432/opulent_tutor?sslmode=verify-full',
    );
    expect(remote.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(remote.ssl && 'ca' in remote.ssl && remote.ssl.ca).toContain('BEGIN CERTIFICATE');

    expect(postgresSsl('postgres://opulent:opulent@localhost:5432/opulent_tutor')).toEqual({});
    expect(postgresSsl('not a url')).toEqual({});
  });
});

describe('databaseUrl', () => {
  it('returns the address when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgres://opulent:opulent@localhost:5432/opulent_tutor';
    const connection = await import('./connection-string');
    await expect(connection.ensureDatabaseUrl()).resolves.toBe(process.env.DATABASE_URL);
    expect(connection.databaseUrl()).toBe(process.env.DATABASE_URL);
    await expect(connection.resolveConnectionString()).resolves.toBe(process.env.DATABASE_URL);
  });

  it('throws when no address is configured', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_SECRET_ARN;
    delete process.env.DB_HOST;
    const connection = await import('./connection-string');
    expect(() => connection.databaseUrl()).toThrow(/DATABASE_URL is not set/);
    await expect(connection.resolveConnectionString()).rejects.toThrow(/Set DATABASE_URL/);
  });
});
