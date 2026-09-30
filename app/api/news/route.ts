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
    const sourceType = searchParams.get('source_type')
    const verificationStatus = searchParams.get('verification_status')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    // Fetch sources first
    let sourcesQuery = supabase
      .from('sources')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('first_discovered_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (sourceType) {
      sourcesQuery = sourcesQuery.eq('source_type', sourceType)
    }

    const { data: sources, error: sourcesError } = await sourcesQuery

    if (sourcesError) throw sourcesError
    if (!sources || sources.length === 0) {
      return NextResponse.json({ data: [], count: 0 })
    }

    const sourceIds = sources.map(s => s.id)

    // Fetch evidence for these sources
    let evidenceQuery = supabase
      .from('evidence')
      .select(`
        id,
        source_id,
        claim_text,
        excerpt,
        confidence,
        polarity,
        verification_status,
        evidence_type,
        entities:evidence_entities (entity:entities (id, name, entity_type))
      `)
      .in('source_id', sourceIds)
      .eq('workspace_id', workspaceId)

    if (verificationStatus) {
      evidenceQuery = evidenceQuery.eq('verification_status', verificationStatus)
    }

    const { data: evidence, error: evError } = await evidenceQuery

    if (evError) throw evError

    // Group evidence by source_id
    const evidenceBySource = new Map()
    evidence?.forEach(e => {
      if (!evidenceBySource.has(e.source_id)) {
        evidenceBySource.set(e.source_id, [])
      }
      evidenceBySource.get(e.source_id).push(e)
    })

    // Fetch research_run_sources for trigger_type
    const { data: rrsData, error: rrsError } = await supabase
      .from('research_run_sources')
      .select(`
        source_id,
        research_run:research_runs (id, trigger_type, workspace_domain_id)
      `)
      .in('source_id', sourceIds)

    if (rrsError) throw rrsError

    const rrsBySource = new Map()
    rrsData?.forEach(rrs => {
      if (!rrsBySource.has(rrs.source_id)) {
        rrsBySource.set(rrs.source_id, [])
      }
      rrsBySource.get(rrs.source_id).push(rrs)
    })

    // Filter by domain if needed
    let filteredSources = sources
    if (domainId) {
      filteredSources = sources.filter(source => {
        const rrs = rrsBySource.get(source.id) || []
        return rrs.some((r: any) => r.research_run?.workspace_domain_id === domainId)
      })
    }

    // Transform sources into feed items
    const feedItems = filteredSources.map((source: any) => {
      const sourceEvidence = evidenceBySource.get(source.id) || []
      const verifiedEvidence = sourceEvidence.filter((e: any) => e.verification_status === 'verified')
      const totalEvidence = sourceEvidence.length
      const rrs = rrsBySource.get(source.id) || []
      // An entity can be connected to more than one evidence record for the
      // same source. Present it once in the feed, with its stable entity id.
      const entities = Array.from(
        new Map(
          sourceEvidence
            .flatMap((e: any) => e.entities?.map((ee: any) => ee.entity) || [])
            .filter((entity: any) => entity?.id)
            .map((entity: any) => [entity.id, entity])
        ).values()
      )
      
      return {
        id: source.id,
        type: 'source',
        title: source.title,
        publisher: source.publisher,
        url: source.canonical_url,
        sourceType: source.source_type,
        publishedAt: source.published_at || source.first_discovered_at,
        discoveredAt: source.first_discovered_at,
        qualityScore: source.source_quality_score,
        extractionStatus: source.extraction_status,
        evidenceCount: totalEvidence,
        verifiedEvidenceCount: verifiedEvidence.length,
        topClaims: verifiedEvidence.slice(0, 3).map((e: any) => e.claim_text),
        entities,
        triggerType: rrs[0]?.research_run?.trigger_type,
      }
    })

    return NextResponse.json({ data: feedItems, count: feedItems.length })
  } catch (error) {
    console.error('News feed API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
