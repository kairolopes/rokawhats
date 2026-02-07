import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProfileByUserId, upsertProfile } from '../../../../../lib/profile'
import { getUserIdFromToken } from 'lib/auth'

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const requesterId = await getUserIdFromToken(token) as string | null
  if (!requesterId) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })

  const admin = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  const override = (req.headers.get('x-admin-secret') || '') === (process.env.MAKE_WEBHOOK_SECRET || '')
  let requesterWorkspaceId: string | undefined = undefined
  if (!override) {
    const { data: requester } = await getProfileByUserId(admin, requesterId!)
    if (!requester || (requester.role !== 'master' && requester.role !== 'admin')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    requesterWorkspaceId = requester.workspace_id as string | undefined
  }

  const raw = await req.text()
  let body: any = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    body = {}
  }
  const email = body?.email as string
  const password = body?.password as string
  const name = body?.name as string
  const role = body?.role as 'admin' | 'agent'
  const workspaceId = (body?.workspaceId as string) || requesterWorkspaceId
  if (!email || !password || !name || !role || !workspaceId) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

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
  const { error: upsertErr } = await upsertProfile(admin, { user_id: userId, name, role, workspace_id: workspaceId })
  if (upsertErr) {
    return NextResponse.json({ error: 'profile_upsert_failed' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, user_id: userId })
}
