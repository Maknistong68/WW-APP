import { defineConfig } from 'vitest/config'

export default defineConfig({
  // the Edge Functions' shared, pure helpers are tested here too
  test: { environment: 'node', include: ['src/**/*.test.ts', 'supabase/functions/_shared/**/*.test.ts'] },
})
