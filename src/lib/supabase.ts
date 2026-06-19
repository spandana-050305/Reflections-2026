// Local-only mode — no Supabase connection needed.
// Returns the file-backed mock client for all browser usage.
import { createMockBrowserClient } from './mock-client.browser'

export function createClient() {
  return createMockBrowserClient() as any
}
