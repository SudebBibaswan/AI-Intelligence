import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678'
const N8N_API_KEY = process.env.N8N_API_KEY || process.env.N8N_WEBHOOK_SECRET

interface TriggerRequest {
  workspace_id: string
  workspace_domain_id: string
  trigger_type: 'manual' | 'schedule' | 'validation' | 'backfill'
  engine?: 'research' | 'observation' | 'signal' | 'hypothesis' | 'pattern' | 'quality' | 'thesis' | 'validation' | 'capital_flow' | 'evidence_review' | 'all'
  config?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: TriggerRequest = await request.json()
    const { workspace_id, workspace_domain_id, trigger_type, engine = 'all', config = {} } = body

    if (!workspace_id || !workspace_domain_id) {
      return NextResponse.json({ error: 'workspace_id and workspace_domain_id required' }, { status: 400 })
    }

    // Verify user owns this workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspace_id)
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // The caller has passed the workspace-membership check above. Queue runs
    // through the server-only client because research_runs is engine-managed
    // and intentionally has no browser insert policy.
    const admin = createAdminClient()

    // Create research run record
    const idempotencyKey = `${workspace_id}-${workspace_domain_id}-${trigger_type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    
    const { data: researchRun, error: runError } = await admin
      .from('research_runs')
      .insert({
        workspace_id,
        workspace_domain_id,
        trigger_type,
        idempotency_key: idempotencyKey,
        contract_version: '1.0.0',
        config_snapshot: config,
        requested_by: user.id,
        status: 'queued',
      })
      .select()
      .single()

    if (runError) throw runError

    // Trigger n8n workflow(s)
    const workflowMap: Record<string, { name: string; webhook: string }> = {
      research: { name: 'Research Engine', webhook: process.env.N8N_WEBHOOK_RESEARCH_ENGINE || `${N8N_BASE_URL}/webhook/research-engine-trigger` },
      observation: { name: 'Verified Observation Engine', webhook: process.env.N8N_WEBHOOK_OBSERVATION || `${N8N_BASE_URL}/webhook/verified-observation-engine-trigger` },
      signal: { name: 'Verified Signal Engine', webhook: process.env.N8N_WEBHOOK_SIGNAL || `${N8N_BASE_URL}/webhook/verified-signal-engine-trigger` },
      hypothesis: { name: 'Verified Hypothesis Engine', webhook: process.env.N8N_WEBHOOK_HYPOTHESIS || `${N8N_BASE_URL}/webhook/verified-hypothesis-engine-trigger` },
      pattern: { name: 'Verified Pattern Engine', webhook: process.env.N8N_WEBHOOK_PATTERN || `${N8N_BASE_URL}/webhook/verified-pattern-engine-trigger` },
      quality: { name: 'Verified Quality Engine', webhook: process.env.N8N_WEBHOOK_QUALITY || `${N8N_BASE_URL}/webhook/verified-quality-engine-trigger` },
      thesis: { name: 'Verified Thesis Engine', webhook: process.env.N8N_WEBHOOK_THESIS || `${N8N_BASE_URL}/webhook/verified-thesis-engine-trigger` },
      validation: { name: 'Verified Validation Engine', webhook: process.env.N8N_WEBHOOK_VALIDATION || `${N8N_BASE_URL}/webhook/verified-validation-engine-trigger` },
      capital_flow: { name: 'Verified Capital Flow Engine', webhook: process.env.N8N_WEBHOOK_CAPITAL || `${N8N_BASE_URL}/webhook/verified-capital-flow-engine-trigger` },
      evidence_review: { name: 'Verified Evidence Review Engine', webhook: process.env.N8N_WEBHOOK_EVIDENCE_REVIEW || `${N8N_BASE_URL}/webhook/verified-evidence-review-engine-trigger` },
    }

    const enginesToRun = engine === 'all' ? Object.keys(workflowMap) : [engine]
    const results = []

    for (const eng of enginesToRun) {
      const workflow = workflowMap[eng]
      if (!workflow) continue

      try {
        // Call n8n webhook to trigger workflow
        const webhookUrl = workflow.webhook
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(N8N_API_KEY && { 'Authorization': `Bearer ${N8N_API_KEY}` }),
          },
          body: JSON.stringify({
            workspace_id,
            workspace_domain_id,
            research_run_id: researchRun.id,
            trigger_type,
            engine: eng,
            config,
          }),
        })

        if (response.ok) {
          results.push({ engine: eng, status: 'triggered', workflow: workflow.name })
        } else {
          results.push({ engine: eng, status: 'failed', error: `HTTP ${response.status}`, workflow: workflow.name })
        }
      } catch (err) {
        results.push({ engine: eng, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error', workflow: workflow.name })
      }
    }

    // Update research run with trigger results
    await admin
      .from('research_runs')
      .update({
        status: results.some(r => r.status === 'triggered') ? 'discovering' : 'failed',
        metrics: { trigger_results: results },
        started_at: new Date().toISOString(),
      })
      .eq('id', researchRun.id)

    return NextResponse.json({ 
      research_run_id: researchRun.id,
      results,
      message: `Triggered ${results.filter(r => r.status === 'triggered').length} of ${enginesToRun.length} engines`
    })
  } catch (error) {
    console.error('Trigger research run error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    // Verify user owns this workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      // The UI consumes the quality read model, which aliases the primary id
      // as research_run_id and includes the run metrics shown on each card.
      .from('v_research_quality_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Get research runs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
