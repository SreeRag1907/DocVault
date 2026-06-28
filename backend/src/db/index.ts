import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  /**
   * search_vector is a GENERATED column: Postgres recomputes it itself
   * whenever filename / extracted_text / ai_summary change, so the app
   * never has to remember to keep an index in sync by hand. The GIN
   * index is what makes `@@ plainto_tsquery(...)` fast instead of a
   * full table scan.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      owner_id INT NOT NULL REFERENCES users(id),
      original_filename TEXT NOT NULL,
      s3_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image')),
      size_bytes BIGINT NOT NULL DEFAULT 0,
      extracted_text TEXT,
      ai_summary TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      is_favorite BOOLEAN NOT NULL DEFAULT false,
      share_token TEXT UNIQUE,
      search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english',
          coalesce(original_filename, '') || ' ' ||
          coalesce(extracted_text, '') || ' ' ||
          coalesce(ai_summary, '')
        )
      ) STORED,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS documents_search_idx ON documents USING GIN (search_vector);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents (owner_id);
  `);
}
