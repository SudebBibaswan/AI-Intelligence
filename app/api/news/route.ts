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

    // Get sources with evidence
    let query = supabase
      .from('sources')
      .select(`
        *,
        evidence:evidence_id (
          id,
          claim_text,
          excerpt,
          confidence,
          polarity,
          verification_status,
          evidence_type,
          entities:evidence_entities (
            entity:entities (id, name, entity_type)
          )
        ),
        research_run_sources!research_run_sources_source_id_fkey (
          research_run:research_runs!research_run_sources_research_run_id_fkey (
            id,
            trigger_type,
            created_at
          )
        )
      `)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('first_discovered_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (domainId) {
      // Filter by workspace_domain through research_runs
      query = query.filter('research_run_sources.research_run.workspace_domain_id', 'eq', domainId)
    }

    if (sourceType) {
      query = query.eq('source_type', sourceType)
    }

    if (verificationStatus) {
      query = query.filter('evidence.verification_status', 'eq', verificationStatus)
    }

    const { data, error } = await query

    if (error) throw error

    // Transform sources into feed items
    const feedItems = (data || []).map((source: any) => {
      const verifiedEvidence = source.evidence?.filter((e: any) => e.verification_status === 'verified') || []
      const totalEvidence = source.evidence?.length || 0
      
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
        entities: source.evidence?.flatMap((e: any) => e.entities?.map((ee: any) => ee.entity)) || [],
        triggerType: source.research_run_sources?.[0]?.research_run?.trigger_type,
      }
    })

    return NextResponse.json({ data: feedItems, count: feedItems.length })
  } catch (error) {
    console.error('News feed API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}