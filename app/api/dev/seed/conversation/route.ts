import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const raw = await req.text()
  let body: any = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    body = {}
  }
  const workspaceId = body?.workspaceId as string
  if (!workspaceId) {
    return NextResponse.json({ error: 'missing_workspaceId' }, { status: 400 })
  }
  const admin = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  const { data, error } = await admin
    .from('conversations')
    .insert({ workspace_id: workspaceId, created_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'seed_failed' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, conversation_id: data.id })
}
