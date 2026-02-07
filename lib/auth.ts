export function decodeJwt(token: string) {
  const parts = token?.split('.') ?? []
  if (parts.length < 2) return null
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const pad = payload.length % 4 ? '='.repeat(4 - (payload.length % 4)) : ''
  const json = Buffer.from(payload + pad, 'base64').toString('utf8')
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

import { createClient } from '@supabase/supabase-js'
export async function getUserIdFromToken(token: string) {
  const jwt = decodeJwt(token || '')
  if (jwt?.sub) return jwt.sub as string
  const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { data } = await supabase.auth.getUser(token)
  return data.user?.id || null
}
