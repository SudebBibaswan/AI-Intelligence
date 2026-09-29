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
    const range = searchParams.get('range') || '7 days'

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

    const daysAgo = range === 'Today' ? 0 : range === '7 days' ? 7 : 30
    const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

    // Get counts
    const [
      { count: researchRunsTotal },
      { count: sourcesTotal },
      { count: evidenceTotal },
      { count: signalsTotal },
      { count: observationsTotal },
      { count: patternsTotal },
      { count: hypothesesTotal },
      { count: insightsTotal },
      { data: signalStatus },
      { data: observationStatus },
      { data: patternStatus },
      { data: hypothesisStatus },
      { data: insightStatus },
      { data: recentRuns },
      { data: draftSignals },
    ] = await Promise.all([
      supabase.from('research_runs').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', since),
      supabase.from('sources').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', since).is('deleted_at', null),
      supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('verification_status', 'verified').gte('created_at', since),
      supabase.from('signals').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('observations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('patterns').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('hypotheses').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('theses').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('signals').select('status').eq('workspace_id', workspaceId),
      supabase.from('observations').select('status').eq('workspace_id', workspaceId),
      supabase.from('patterns').select('status').eq('workspace_id', workspaceId),
      supabase.from('hypotheses').select('status').eq('workspace_id', workspaceId),
      supabase.from('theses').select('status').eq('workspace_id', workspaceId),
      supabase.from('research_runs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('v_signal_review_queue').select('signal_id').eq('workspace_id', workspaceId),
    ])

    // Get recent failure
    const { data: lastFailure } = await supabase
      .from('research_runs')
      .select('created_at, error_summary, trigger_type')
      .eq('workspace_id', workspaceId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)

    // Get last success
    const { data: lastSuccess } = await supabase
      .from('research_runs')
      .select('created_at, trigger_type')
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)

    // Daily stats for charts
    const { data: dailyStats } = await supabase
      .rpc('get_daily_research_stats', { p_workspace_id: workspaceId, p_days: daysAgo || 7 })

    const signalDraft = signalStatus?.filter(s => s.status === 'draft').length || 0
    const signalAccepted = signalStatus?.filter(s => s.status === 'accepted').length || 0
    const signalRejected = signalStatus?.filter(s => s.status === 'rejected').length || 0

    const observationDraft = observationStatus?.filter(s => s.status === 'draft').length || 0
    const observationAccepted = observationStatus?.filter(s => s.status === 'accepted').length || 0

    const patternEmerging = patternStatus?.filter(s => s.status === 'emerging').length || 0
    const patternPersistent = patternStatus?.filter(s => s.status === 'persistent').length || 0
    const patternWeakening = patternStatus?.filter(s => s.status === 'weakening').length || 0

    const hypothesisReady = hypothesisStatus?.filter(s => s.status === 'ready_for_validation').length || 0
    const hypothesisValidating = hypothesisStatus?.filter(s => s.status === 'validating').length || 0
    const hypothesisComplete = hypothesisStatus?.filter(s => ['supported', 'mixed', 'weakened', 'inconclusive'].includes(s.status)).length || 0

    const insightDraft = insightStatus?.filter(s => s.status === 'draft').length || 0
    const insightPublished = insightStatus?.filter(s => s.status === 'accepted').length || 0

    return NextResponse.json({
      counts: {
        researchRuns: researchRunsTotal || 0,
        sources: sourcesTotal || 0,
        evidence: evidenceTotal || 0,
        signals: signalsTotal || 0,
        observations: observationsTotal || 0,
        patterns: patternsTotal || 0,
        hypotheses: hypothesesTotal || 0,
        insights: insightsTotal || 0,
      },
      signalStatus: {
        draft: signalDraft,
        accepted: signalAccepted,
        rejected: signalRejected,
      },
      observationStatus: {
        draft: observationDraft,
        accepted: observationAccepted,
      },
      patternStatus: {
        emerging: patternEmerging,
        persistent: patternPersistent,
        weakening: patternWeakening,
      },
      hypothesisStatus: {
        ready: hypothesisReady,
        validating: hypothesisValidating,
        complete: hypothesisComplete,
      },
      insightStatus: {
        draft: insightDraft,
        published: insightPublished,
      },
      draftSignalsCount: draftSignals?.length || 0,
      recentRuns: recentRuns || [],
      lastFailure: lastFailure?.[0] || null,
      lastSuccess: lastSuccess?.[0] || null,
      dailyStats: dailyStats || [],
    })
  } catch (error) {
    console.error('Admin overview error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}