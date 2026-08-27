import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

export let pool;

if (process.env.DB_MODE === 'memory') {
  const { newDb } = await import('pg-mem');
  const mem = newDb();
  const schema = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf-8');
  mem.public.none(schema);
  const adapter = mem.adapters.createPg();
  pool = new adapter.Pool();
} else {
  const pg = (await import('pg')).default;
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}
