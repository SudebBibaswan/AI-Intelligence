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

    // Get research runs with error details
    const { data: runs, error } = await supabase
      .from('research_runs')
      .select(`
        id,
        research_run_id,
        trigger_type,
        status,
        error_summary,
        created_at,
        started_at,
        completed_at,
        duration_seconds,
        llm_calls,
        failed_llm_calls,
        estimated_cost_usd,
        workspace_domain:workspace_domains!inner (
          domain:domains (key)
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const requests = (runs || []).map(run => ({
      time: run.created_at,
      id: run.research_run_id?.slice(0, 12) || run.id.slice(0, 12),
      workflow: `${run.trigger_type} / ${run.status}`,
      provider: 'OpenAI',
      model: 'gpt-6-luna',
      success: run.status === 'completed',
      latency: run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : 'N/A',
      tokens: `${(run.llm_calls || 0) * 13000} / ${(run.llm_calls || 0) * 1700}`,
      cost: '$' + (run.estimated_cost_usd || 0).toFixed(4),
      error: run.status === 'failed' ? (run.error_summary as any)?.message || 'Unknown error' : run.status === 'partial' ? 'Partial completion' : '—',
      related: run.id,
    }))

    return NextResponse.json({ data: requests, count: requests.length })
  } catch (error) {
    console.error('Admin requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}