import { createClient } from '@supabase/supabase-js'
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

type LogEntry = {
  workspaceId?: string
  route: string
  provider?: string
  externalMessageId?: string
  status?: string
  error?: string | null
  payload: unknown
}

export async function logWebhook(entry: LogEntry) {
  const { error } = await supabaseAdmin
    .from('webhook_logs')
    .insert({
      workspace_id: entry.workspaceId ?? null,
      route: entry.route,
      provider: entry.provider ?? null,
      external_message_id: entry.externalMessageId ?? null,
      status: entry.status ?? null,
      error: entry.error ?? null,
      payload: entry.payload,
      created_at: new Date().toISOString(),
    })
  return error
}
