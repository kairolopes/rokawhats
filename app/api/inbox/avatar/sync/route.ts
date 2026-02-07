import { NextResponse } from 'next/server'
import { logWebhook } from '../../../../../lib/logger'
import { ensureBuckets, uploadToSupabaseStorage } from '../../../../../lib/storage'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const workspaceId = body?.workspaceId as string | undefined
  const contactPhone = body?.contactPhone as string | undefined
  const avatarUrl = body?.avatarUrl as string | undefined
  const secret = req.headers.get('x-make-secret')
  if (!secret || secret !== process.env.MAKE_WEBHOOK_SECRET) {
    await logWebhook({
      workspaceId,
      route: '/api/inbox/avatar/sync',
      status: 'unauthorized',
      error: 'invalid_secret',
      payload: body,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!workspaceId || !contactPhone || !avatarUrl) {
    await logWebhook({
      workspaceId,
      route: '/api/inbox/avatar/sync',
      status: 'invalid',
      error: 'missing_fields',
      payload: body,
    })
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  await ensureBuckets()

  let buffer: Buffer
  let contentType = 'image/jpeg'
  try {
    const res = await fetch(avatarUrl)
    if (!res.ok) {
      await logWebhook({
        workspaceId,
        route: '/api/inbox/avatar/sync',
        status: 'error',
        error: `download_failed status=${res.status}`,
        payload: { avatarUrl },
      })
      return NextResponse.json({ error: 'download_failed' }, { status: 502 })
    }
    const arr = await res.arrayBuffer()
    buffer = Buffer.from(arr)
    contentType = res.headers.get('content-type') || contentType
  } catch (e: any) {
    await logWebhook({
      workspaceId,
      route: '/api/inbox/avatar/sync',
      status: 'error',
      error: e?.message || 'download_error',
      payload: { avatarUrl },
    })
    return NextResponse.json({ error: 'download_error' }, { status: 502 })
  }

  const path = `avatars/${workspaceId}/contacts/${contactPhone}.jpg`
  try {
    const upload = await uploadToSupabaseStorage({
      bucket: 'avatars',
      path,
      buffer,
      contentType,
      upsert: true,
      signedSeconds: 600,
    })
    const admin = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )
    const { data: existing } = await admin
      .from('contacts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('phone', contactPhone)
      .limit(1)
    let contactId: string | null = null
    if (existing && existing.length > 0) {
      contactId = existing[0].id
      await admin.from('contacts').update({ profile_pic_url: path }).eq('id', contactId)
    } else {
      const { data: inserted } = await admin
        .from('contacts')
        .insert({ workspace_id: workspaceId, phone: contactPhone, profile_pic_url: path })
        .select('id')
        .single()
      contactId = inserted?.id ?? null
    }
    await logWebhook({
      workspaceId,
      route: '/api/inbox/avatar/sync',
      status: 'stored',
      error: null,
      payload: { contactPhone, path, contactId },
    })
    return NextResponse.json({ ok: true, path: upload.path, signedUrl: upload.signedUrl })
  } catch (e: any) {
    await logWebhook({
      workspaceId,
      route: '/api/inbox/avatar/sync',
      status: 'error',
      error: e?.message || 'store_error',
      payload: { contactPhone, path },
    })
    return NextResponse.json({ error: 'store_error' }, { status: 500 })
  }
}
