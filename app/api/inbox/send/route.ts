import { NextResponse } from 'next/server'
import { logWebhook } from '../../../../lib/logger'

export async function POST(req: Request) {
  const body = await req.json()
  const workspaceId = body?.workspaceId as string | undefined

  const url = process.env.MAKE_OUTBOX_WEBHOOK_URL as string
  if (!url) {
    await logWebhook({
      workspaceId,
      route: '/api/inbox/send',
      status: 'invalid',
      error: 'missing MAKE_OUTBOX_WEBHOOK_URL',
      payload: body,
    })
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-make-secret': process.env.MAKE_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    await logWebhook({
      workspaceId,
      route: '/api/inbox/send',
      status: res.ok ? 'forwarded' : 'error',
      error: res.ok ? null : `status=${res.status} body=${text}`,
      payload: body,
    })
    return NextResponse.json({ ok: res.ok, status: res.status })
  } catch (e: any) {
    await logWebhook({
      workspaceId,
      route: '/api/inbox/send',
      status: 'error',
      error: e?.message || 'unknown_error',
      payload: body,
    })
    return NextResponse.json({ error: 'forward_failed' }, { status: 502 })
  }
}
