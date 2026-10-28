import { loadEnv } from './load-env';
import { assertLocalDatabase } from './local-only';

loadEnv();
assertLocalDatabase();
