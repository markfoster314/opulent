import { handle } from 'hono/aws-lambda';
import { createApp } from './app';

/**
 * Production entry point: the whole API in one Lambda function, sometimes called
 * a "lambdalith".
 *
 * The app is built once at module load, outside the handler, so warm
 * invocations reuse the router, the Auth0 key set and the database pool.
 * Because the inside is a plain fetch-style app, moving to AWS Fargate later
 * means swapping this file for src/index.ts and nothing else.
 */
export const handler = handle(createApp());
