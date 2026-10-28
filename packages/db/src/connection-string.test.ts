import { describe, expect, it } from 'vitest';
import { awsDatabaseUrl, postgresSsl } from './connection-string';

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
  });
});
