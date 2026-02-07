import { NextResponse } from 'next/server'
import { logWebhook } from '../../../../../lib/logger'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const secret = req.headers.get('x-make-secret')
  if (!secret || secret !== process.env.MAKE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const workspaceId = body?.workspaceId as string | undefined
  const externalMessageId = body?.externalMessageId as string | undefined

  if (!externalMessageId) {
    await logWebhook({
      workspaceId,
      route: '/api/inbox/message/status',
      status: 'invalid',
      error: 'missing externalMessageId',
      payload: body,
    })
    return NextResponse.json({ error: 'missing externalMessageId' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )
  const { data: existing } = await supabaseAdmin
    .from('webhook_logs')
    .select('id')
    .eq('route', '/api/inbox/message/status')
    .eq('external_message_id', externalMessageId)
    .limit(1)

  if (existing && existing.length > 0) {
    await logWebhook({
      workspaceId,
      route: '/api/inbox/message/status',
      externalMessageId,
      status: 'duplicate',
      error: null,
      payload: body,
    })
    return NextResponse.json({ ok: true, deduped: true })
  }

  const logErr = await logWebhook({
    workspaceId,
    route: '/api/inbox/message/status',
    externalMessageId,
    status: 'received',
    error: null,
    payload: body,
  })

  if (logErr) {
    return NextResponse.json({ error: 'log_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
