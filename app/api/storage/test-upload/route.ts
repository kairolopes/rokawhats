import { NextResponse } from 'next/server'
import { ensureBuckets, uploadToSupabaseStorage } from '../../../../lib/storage'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const workspaceId = (body?.workspaceId as string) ?? '00000000-0000-0000-0000-000000000000'
  const conversationId = (body?.conversationId as string) ?? '11111111-1111-1111-1111-111111111111'
  const messageId = (body?.messageId as string) ?? '22222222-2222-2222-2222-222222222222'
  const contactId = (body?.contactId as string) ?? '33333333-3333-3333-3333-333333333333'

  await ensureBuckets()

  const txt = Buffer.from('simplewhats storage test\n')
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009077' +
      '530000000a49444154789c63600000020001a0a2e21d0000000049454e44ae426082',
    'hex'
  )

  const att = await uploadToSupabaseStorage({
    bucket: 'attachments',
    path: `attachments/${workspaceId}/conversations/${conversationId}/${messageId}/hello.txt`,
    buffer: txt,
    contentType: 'text/plain',
    upsert: true,
    signedSeconds: 600,
  })

  const avatar = await uploadToSupabaseStorage({
    bucket: 'avatars',
    path: `avatars/${workspaceId}/contacts/${contactId}.jpg`,
    buffer: png,
    contentType: 'image/png',
    upsert: true,
    signedSeconds: 600,
  })

  return NextResponse.json({
    ok: true,
    attachments: att,
    avatar,
  })
}
