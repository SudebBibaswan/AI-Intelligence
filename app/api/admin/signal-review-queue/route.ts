import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    // Verify user is workspace member
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin', 'member'].includes(membership.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get signal review queue with evidence stats
    const { data, error } = await supabase
      .from('v_signal_review_queue')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('importance_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({ data: data || [], count: data?.length || 0 })
  } catch (error) {
    console.error('Admin signal review queue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}