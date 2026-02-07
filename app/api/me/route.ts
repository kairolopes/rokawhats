import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProfileByUserId } from '../../../lib/profile'
import { getUserIdFromToken } from 'lib/auth'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = await getUserIdFromToken(token) as string | null
  if (!userId) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  const s = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  const { data, error } = await getProfileByUserId(s, userId)
  if (error || !data) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  return NextResponse.json({
    id: data.user_id,
    name: data.name,
    role: data.role,
    workspace_id: data.workspace_id,
  })
}
