import { handle } from 'hono/aws-lambda';
import { createApp } from './app';

/** Built at module load for warm reuse; plain fetch app also allows moving to Fargate. */
export const handler = handle(createApp());
