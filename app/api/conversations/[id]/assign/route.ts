import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProfileByUserId } from '../../../../../lib/profile'
import { getUserIdFromToken } from 'lib/auth'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const requesterId = await getUserIdFromToken(token) as string | null
  if (!requesterId) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })

  const admin = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  const { data: requester } = await getProfileByUserId(admin, requesterId!)
  if (!requester || (requester.role !== 'master' && requester.role !== 'admin')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as any))
  const u = new URL(req.url)
  const qpAgentId = u.searchParams.get('agentId')
  const agentId = (body?.agentId as string) || (qpAgentId as string | null) || ''
  if (!agentId) return NextResponse.json({ error: 'missing_agentId' }, { status: 400 })

  const conversationId = params.id
  const { data: conv } = await admin
    .from('conversations')
    .select('id,assigned_agent_id,workspace_id')
    .eq('id', conversationId)
    .limit(1)
    .single()
  if (!conv) return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 })
  if (conv.workspace_id !== requester.workspace_id) return NextResponse.json({ error: 'workspace_mismatch' }, { status: 403 })

  const { error: updErr } = await admin
    .from('conversations')
    .update({ assigned_agent_id: agentId })
    .eq('id', conversationId)
  if (updErr) return NextResponse.json({ error: 'assign_failed' }, { status: 400 })

  await admin
    .from('conversation_assignments')
    .insert({ conversation_id: conversationId, agent_id: agentId, assigned_at: new Date().toISOString() })

  return NextResponse.json({ ok: true })
}
