/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Built-in Supabase project (set in .env.production) — optional. */
  readonly VITE_SUPABASE_URL?: string
  /** Public anon key of that project; all data is protected by row-level security. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
