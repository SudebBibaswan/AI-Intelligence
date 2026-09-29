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
    const hypothesisId = searchParams.get('hypothesis_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    // Fetch validation runs first
    let runsQuery = supabase
      .from('validation_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (hypothesisId) {
      runsQuery = runsQuery.eq('hypothesis_id', hypothesisId)
    }

    const { data: runs, error: runsError } = await runsQuery

    if (runsError) throw runsError
    if (!runs || runs.length === 0) {
      return NextResponse.json({ data: [], count: 0 })
    }

    const runIds = runs.map(r => r.id)

    // Fetch validation_evidence with evidence and sources
    const { data: validationEvidence, error: veError } = await supabase
      .from('validation_evidence')
      .select('id, validation_run_id, evidence_id, dimension, stance, weight, reasoning_summary')
      .in('validation_run_id', runIds)
      .eq('workspace_id', workspaceId)

    if (veError) throw veError

    // Fetch evidence for these validations
    const evidenceIds = [...new Set(validationEvidence?.map(ve => ve.evidence_id) || [])]
    let evidenceMap = new Map()
    
    if (evidenceIds.length > 0) {
      const { data: evidenceData, error: evError } = await supabase
        .from('evidence')
        .select(`
          id,
          source_id,
          claim_text,
          excerpt,
          confidence,
          verification_status,
          evidence_type,
          source:sources (id, title, publisher, canonical_url)
        `)
        .in('id', evidenceIds)
        .eq('workspace_id', workspaceId)

      if (evError) throw evError
      evidenceMap = new Map(evidenceData?.map(e => [e.id, e]) || [])
    }

    // Fetch hypotheses for these runs
    const hypothesisIds = [...new Set(runs.map(r => r.hypothesis_id).filter(Boolean))]
    let hypothesisMap = new Map()
    
    if (hypothesisIds.length > 0) {
      let hypQuery = supabase
        .from('hypotheses')
        .select('id, title, statement, target_user, problem')
        .in('id', hypothesisIds)
        .eq('workspace_id', workspaceId)
      
      if (domainId) {
        hypQuery = hypQuery.eq('workspace_domain_id', domainId)
      }
      
      const { data: hypData, error: hypError } = await hypQuery
      if (hypError) throw hypError
      hypothesisMap = new Map(hypData?.map(h => [h.id, h]) || [])
    }

    // Combine data
    const runsWithRelations = runs.map(run => ({
      ...run,
      validation_evidence: validationEvidence
        ?.filter(ve => ve.validation_run_id === run.id)
        .map(ve => ({
          ...ve,
          evidence: evidenceMap.get(ve.evidence_id) || null
        }))
        .filter(ve => ve.evidence !== null) || [],
      hypothesis: run.hypothesis_id ? hypothesisMap.get(run.hypothesis_id) || null : null
    }))

    // Filter by domain if needed (via hypothesis)
    let filteredRuns = runsWithRelations
    if (domainId) {
      filteredRuns = runsWithRelations.filter(r => r.hypothesis?.workspace_domain_id === domainId)
    }

    return NextResponse.json({ data: filteredRuns, count: filteredRuns.length })
  } catch (error) {
    console.error('Validations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}