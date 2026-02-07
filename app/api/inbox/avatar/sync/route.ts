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
  if (!workspaceId || !contactPhone) {
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

  let buffer: Buffer | null = null
  let contentType = 'image/jpeg'
  if (avatarUrl) {
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
  } else {
    try {
      const tmpl = process.env.ZAPI_AVATAR_URL_TEMPLATE as string | undefined
      const clientToken = process.env.ZAPI_CLIENT_TOKEN as string | undefined
      if (tmpl) {
        const base = tmpl.replace('{PHONE}', contactPhone)
        const headers: Record<string, string> = {}
        if (clientToken) headers['client-token'] = clientToken
        let res = await fetch(base, { headers })
        if (res.ok) {
          const ct = res.headers.get('content-type') || ''
          if (ct.startsWith('image/')) {
            const arr = await res.arrayBuffer()
            buffer = Buffer.from(arr)
            contentType = ct || contentType
          } else {
            const j = await res.json().catch(() => null as any)
            const pic = j?.profilePicUrl || j?.avatarUrl || j?.url || null
            if (pic) {
              const r2 = await fetch(pic)
              if (r2.ok) {
                const arr2 = await r2.arrayBuffer()
                buffer = Buffer.from(arr2)
                contentType = r2.headers.get('content-type') || contentType
              }
            }
          }
        } else if (clientToken) {
          const withToken = base.includes('?')
            ? `${base}&client_token=${clientToken}`
            : `${base}?client_token=${clientToken}`
          res = await fetch(withToken)
          if (res.ok) {
            const ct = res.headers.get('content-type') || ''
            if (ct.startsWith('image/')) {
              const arr = await res.arrayBuffer()
              buffer = Buffer.from(arr)
              contentType = ct || contentType
            } else {
              const j = await res.json().catch(() => null as any)
              const pic = j?.profilePicUrl || j?.avatarUrl || j?.url || null
              if (pic) {
                const r2 = await fetch(pic)
                if (r2.ok) {
                  const arr2 = await r2.arrayBuffer()
                  buffer = Buffer.from(arr2)
                  contentType = r2.headers.get('content-type') || contentType
                }
              }
            }
          }
        }
      }
    } catch (e: any) {
      await logWebhook({
        workspaceId,
        route: '/api/inbox/avatar/sync',
        status: 'error',
        error: e?.message || 'fallback_error',
        payload: { contactPhone },
      })
    }
    if (!buffer) {
      await logWebhook({
        workspaceId,
        route: '/api/inbox/avatar/sync',
        status: 'skipped',
        error: 'no_avatar',
        payload: body,
      })
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 })
    }
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
