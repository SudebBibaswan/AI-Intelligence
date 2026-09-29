import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, email, organisation, role, interest } = await request.json()
    
    if (!name || !email) {
      return NextResponse.json({ error: 'name and email required' }, { status: 400 })
    }

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        display_name: name,
        onboarding_state: 'complete',
      })
      .eq('user_id', user.id)

    if (profileError) throw profileError

    // Get user's workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()

    // Store profile details in workspace settings or a separate table
    if (workspaceMember) {
      await supabase
        .from('workspaces')
        .update({
          settings: {
            user_profile: { name, email, organisation, role, interest },
            onboarding_completed_at: new Date().toISOString(),
          }
        })
        .eq('id', workspaceMember.workspace_id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Onboarding profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}