import { NextResponse } from 'next/server'
import { makePing } from '../../../../lib/make'
import { logWebhook } from '../../../../lib/logger'

export async function GET() {
  const token = process.env.MAKE_API_TOKEN as string
  if (!token) {
    await logWebhook({
      route: '/api/make/ping',
      status: 'invalid',
      error: 'missing MAKE_API_TOKEN',
      payload: null,
    })
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const result = await makePing(token)
  await logWebhook({
    route: '/api/make/ping',
    status: result.ok ? 'success' : 'error',
    error: result.ok ? null : `status=${result.status} body=${result.body}`,
    payload: { status: result.status },
  })
  return NextResponse.json({ ok: result.ok, status: result.status, body: result.body })
}
