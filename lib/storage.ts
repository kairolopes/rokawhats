import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )
}

export async function ensureBuckets() {
  const s = supabaseAdmin()
  const { data: buckets } = await s.storage.listBuckets()
  const names = new Set((buckets ?? []).map((b) => b.name))
  if (!names.has('avatars')) {
    await s.storage.createBucket('avatars', { public: false, fileSizeLimit: 10485760 })
  }
  if (!names.has('attachments')) {
    await s.storage.createBucket('attachments', { public: false, fileSizeLimit: 52428800 })
  }
}

export async function downloadRemoteFile(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download_failed status=${res.status}`)
  const arr = await res.arrayBuffer()
  return Buffer.from(arr)
}

export async function uploadToSupabaseStorage(opts: {
  bucket: 'avatars' | 'attachments'
  path: string
  buffer: Buffer
  contentType: string
  upsert?: boolean
  signedSeconds?: number
}) {
  const s = supabaseAdmin()
  const { error } = await s.storage.from(opts.bucket).upload(opts.path, opts.buffer, {
    contentType: opts.contentType,
    upsert: opts.upsert ?? true,
  })
  if (error) throw error
  const seconds = opts.signedSeconds ?? 3600
  const { data: signed } = await s.storage.from(opts.bucket).createSignedUrl(opts.path, seconds)
  return { path: opts.path, signedUrl: signed?.signedUrl ?? null }
}

export async function updateContactAvatar(params: {
  workspaceId: string
  contactId: string
  buffer: Buffer
  contentType: string
}) {
  const path = `avatars/${params.workspaceId}/contacts/${params.contactId}.jpg`
  return uploadToSupabaseStorage({
    bucket: 'avatars',
    path,
    buffer: params.buffer,
    contentType: params.contentType,
    upsert: true,
  })
}

export async function upsertAttachment(params: {
  workspaceId: string
  conversationId: string
  messageId: string
  filename: string
  buffer: Buffer
  contentType: string
}) {
  const path = `attachments/${params.workspaceId}/conversations/${params.conversationId}/${params.messageId}/${params.filename}`
  return uploadToSupabaseStorage({
    bucket: 'attachments',
    path,
    buffer: params.buffer,
    contentType: params.contentType,
    upsert: true,
  })
}
