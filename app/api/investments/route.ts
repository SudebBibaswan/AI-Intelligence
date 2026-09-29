import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function parseAmountUsd(attributes: unknown) {
  const values = asObject(attributes)
  const raw = String(values.amount_usd ?? values.amount ?? '').trim().toLowerCase()
  const currency = String(values.currency ?? '').trim().toUpperCase()

  if (!raw || (currency && currency !== 'USD' && !raw.includes('$') && !raw.includes('usd'))) return 0

  const numeric = Number(raw.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(numeric)) return 0
  if (/\bbn\b|\bbillion\b/.test(raw)) return numeric * 1_000_000_000
  if (/\bm\b|\bmm\b|\bmillion\b/.test(raw)) return numeric * 1_000_000
  if (/\bk\b|\bthousand\b/.test(raw)) return numeric * 1_000
  return numeric
}

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
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10)
    const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    const { data: relationships, error: relationshipError } = await supabase
      .from('relationships')
      .select('id, from_entity_id, to_entity_id, valid_from, confidence, attributes, created_at')
      .eq('workspace_id', workspaceId)
      .eq('relationship_type', 'invested_in')
      .order('valid_from', { ascending: false, nullsFirst: false })
      .limit(1000)

    if (relationshipError) throw relationshipError
    if (!relationships?.length) return NextResponse.json({ data: [], count: 0 })

    const relationshipIds = relationships.map((relationship) => relationship.id)
    const entityIds = [...new Set(relationships.flatMap((relationship) => [relationship.from_entity_id, relationship.to_entity_id]))]

    const [{ data: entities, error: entityError }, { data: links, error: linkError }] = await Promise.all([
      supabase
        .from('entities')
        .select('id, name, entity_type, attributes')
        .eq('workspace_id', workspaceId)
        .in('id', entityIds),
      supabase
        .from('relationship_evidence')
        .select('relationship_id, evidence_id')
        .eq('workspace_id', workspaceId)
        .in('relationship_id', relationshipIds),
    ])

    if (entityError) throw entityError
    if (linkError) throw linkError

    const evidenceIds = [...new Set((links ?? []).map((link) => link.evidence_id))]
    const { data: evidence, error: evidenceError } = evidenceIds.length
      ? await supabase
          .from('evidence')
          .select('id, research_run_id, source_id, claim_text, excerpt, confidence')
          .eq('workspace_id', workspaceId)
          .in('id', evidenceIds)
      : { data: [], error: null }

    if (evidenceError) throw evidenceError

    const runIds = [...new Set((evidence ?? []).map((item) => item.research_run_id))]
    const sourceIds = [...new Set((evidence ?? []).map((item) => item.source_id))]
    const [{ data: runs, error: runError }, { data: sources, error: sourceError }] = await Promise.all([
      runIds.length
        ? supabase
            .from('research_runs')
            .select('id, workspace_domain_id')
            .eq('workspace_id', workspaceId)
            .in('id', runIds)
        : Promise.resolve({ data: [], error: null }),
      sourceIds.length
        ? supabase
            .from('sources')
            .select('id, title, publisher, canonical_url, published_at')
            .eq('workspace_id', workspaceId)
            .in('id', sourceIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (runError) throw runError
    if (sourceError) throw sourceError

    const entityById = new Map((entities ?? []).map((entity) => [entity.id, entity]))
    const runById = new Map((runs ?? []).map((run) => [run.id, run]))
    const sourceById = new Map((sources ?? []).map((source) => [source.id, source]))
    const evidenceById = new Map((evidence ?? []).map((item) => [item.id, item]))
    const evidenceIdsByRelationship = new Map<string, string[]>()

    for (const link of links ?? []) {
      const current = evidenceIdsByRelationship.get(link.relationship_id) ?? []
      current.push(link.evidence_id)
      evidenceIdsByRelationship.set(link.relationship_id, current)
    }

    const rounds = new Map<string, JsonObject>()

    for (const relationship of relationships) {
      const investor = entityById.get(relationship.from_entity_id)
      const company = entityById.get(relationship.to_entity_id)
      if (!investor || !company) continue

      const relatedEvidence = (evidenceIdsByRelationship.get(relationship.id) ?? [])
        .map((id) => evidenceById.get(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))

      if (domainId && !relatedEvidence.some((item) => runById.get(item.research_run_id)?.workspace_domain_id === domainId)) {
        continue
      }

      const attributes = asObject(relationship.attributes)
      const companyAttributes = asObject(company.attributes)
      const amountUsd = parseAmountUsd(attributes)
      const announcedAt = String(attributes.announced_at ?? relationship.valid_from ?? relationship.created_at)
      const roundType = String(attributes.stage ?? attributes.round_type ?? 'Not specified')
      const key = [company.id, announcedAt.slice(0, 10), amountUsd, roundType].join(':')
      const existing = rounds.get(key)
      const evidencePayload = relatedEvidence.map((item) => ({
        id: item.id,
        claim_text: item.claim_text,
        excerpt: item.excerpt,
        confidence: item.confidence,
        source: sourceById.get(item.source_id) ?? null,
      }))

      if (existing) {
        const investors = existing.investors as Array<JsonObject>
        if (!investors.some((entry) => asObject(entry.investor).id === investor.id)) {
          investors.push({ investor: { id: investor.id, name: investor.name, investor_type: investor.entity_type } })
        }
        const currentEvidence = existing.evidence as Array<JsonObject>
        for (const item of evidencePayload) {
          if (!currentEvidence.some((entry) => entry.id === item.id)) currentEvidence.push(item)
        }
        continue
      }

      rounds.set(key, {
        id: relationship.id,
        company: {
          id: company.id,
          name: company.name,
          ai_domain: companyAttributes.ai_domain ?? companyAttributes.sector ?? companyAttributes.industry ?? 'Not specified',
        },
        round_type: roundType,
        amount_usd: amountUsd,
        investors: [{ investor: { id: investor.id, name: investor.name, investor_type: investor.entity_type } }],
        announced_at: announcedAt,
        confidence: relationship.confidence,
        evidence: evidencePayload,
      })
    }

    const allRounds = [...rounds.values()].sort((a, b) =>
      String(b.announced_at).localeCompare(String(a.announced_at))
    )
    const data = allRounds.slice(offset, offset + limit)

    return NextResponse.json({ data, count: allRounds.length })
  } catch (error) {
    console.error('Investments API error:', error)
    return NextResponse.json({ error: 'Failed to load investment activity' }, { status: 500 })
  }
}
