import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { upsertProfile } from '../../../../lib/profile'
import { getUserIdFromToken } from '../../../../lib/auth'

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const raw = await req.text()
  let parsed: any = {}
  try {
    parsed = raw ? JSON.parse(raw) : {}
  } catch {
    const u = new URL(req.url)
    const qpWorkspace = u.searchParams.get('workspaceId')
    const qpName = u.searchParams.get('name')
    parsed = { workspaceId: qpWorkspace ?? undefined, name: qpName ?? undefined }
  }
  let { workspaceId, name } = parsed as any
  if (!workspaceId) {
    workspaceId = req.headers.get('x-workspace-id') || workspaceId
  }
  if (!workspaceId) return NextResponse.json({ error: 'missing_workspaceId' }, { status: 400 })
  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  const admin = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  const { error } = await upsertProfile(admin, { user_id: userId, name: name ?? null, role: 'admin', workspace_id: workspaceId })
  if (error) return NextResponse.json({ error: 'upsert_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, user_id: userId, workspace_id: workspaceId })
}
