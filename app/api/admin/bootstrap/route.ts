import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const body = await req.json()
  const email = body?.email as string
  const password = body?.password as string
  const name = body?.name as string
  const workspaceId = body?.workspaceId as string
  if (!email || !password || !name || !workspaceId) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  const admin = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (error || !created.user) {
    return NextResponse.json({ error: 'create_failed', message: error?.message }, { status: 400 })
  }
  const userId = created.user.id
  const { error: upsertErr } = await admin
    .from('profiles')
    .upsert({ user_id: userId, name, role: 'master', workspace_id: workspaceId }, { onConflict: 'user_id' })
  if (upsertErr) {
    return NextResponse.json({ error: 'profile_upsert_failed' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, user_id: userId })
}
