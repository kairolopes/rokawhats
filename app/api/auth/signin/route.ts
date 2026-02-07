import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const body = await req.json()
  const email = body?.email as string
  const password = body?.password as string
  if (!email || !password) {
    return NextResponse.json({ error: 'missing_credentials' }, { status: 400 })
  }
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_ANON_KEY as string
  )
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return NextResponse.json({ error: 'signin_failed', message: error.message }, { status: 401 })
  }
  return NextResponse.json({
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
    expires_at: data.session?.expires_at,
  })
}
