import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace (owner)
    const { data: workspaceMember, error: wmError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()

    if (wmError || !workspaceMember) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get workspace
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceMember.workspace_id)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Get active workspace_domain with domain info
    const { data: workspaceDomain, error: wdError } = await supabase
      .from('workspace_domains')
      .select(`
        *,
        domain:domains (*)
      `)
      .eq('workspace_id', workspaceMember.workspace_id)
      .eq('status', 'active')
      .single()

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      workspace,
      workspace_domain: workspaceDomain,
      domain: workspaceDomain?.domain,
      profile,
    })
  } catch (error) {
    console.error('Get workspace error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}