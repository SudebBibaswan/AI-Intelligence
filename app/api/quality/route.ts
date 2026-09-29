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
    const domainId = searchParams.get('domain_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    let query = supabase
      .from('research_quality_snapshots')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('snapshot_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (domainId) {
      query = query.eq('workspace_domain_id', domainId)
    }

    const { data, error } = await query

    if (error) throw error

    // Also get latest run quality
    let runsQuery = supabase
      .from('v_research_quality_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (domainId) {
      runsQuery = runsQuery.eq('workspace_domain_id', domainId)
    }

    const { data: runsData, error: runsError } = await runsQuery
    if (runsError) throw runsError

    return NextResponse.json({ 
      snapshots: data, 
      recentRuns: runsData,
      count: data?.length || 0 
    })
  } catch (error) {
    console.error('Quality API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}