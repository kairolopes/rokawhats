import { SupabaseClient } from '@supabase/supabase-js'

export async function getProfileByUserId(s: SupabaseClient, userId: string) {
  let q = s.from('profiles').select('user_id,name,role,workspace_id').eq('user_id', userId).limit(1).single()
  let { data, error } = await q
  if (error) {
    const alt = await s.from('profiles').select('id,name,role,workspace_id').eq('id', userId).limit(1).single()
    if (!alt.error && alt.data) {
      const d = alt.data as any
      return { data: { user_id: d.id, name: d.name, role: d.role, workspace_id: d.workspace_id }, error: null }
    }
    return { data: null, error }
  }
  return { data, error: null }
}

export async function upsertProfile(s: SupabaseClient, payload: { user_id: string; name: string; role: string; workspace_id: string }) {
  let { error } = await s.from('profiles').upsert(payload, { onConflict: 'user_id' })
  if (error) {
    const { error: error2 } = await s
      .from('profiles')
      .upsert({ id: payload.user_id, name: payload.name, role: payload.role, workspace_id: payload.workspace_id }, { onConflict: 'id' })
    if (error2) return { error: error2 }
    return { error: null }
  }
  return { error: null }
}
