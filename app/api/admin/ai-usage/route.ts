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

    // Get research quality runs with LLM usage
    const { data: runs, error } = await supabase
      .from('research_quality_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Aggregate by day/workflow/provider
    const dailyMap = new Map<string, any>()

    runs?.forEach(run => {
      const day = run.created_at.split('T')[0]
      const key = `${day}-${run.trigger_type}`
      
      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          date: day,
          workflow: run.trigger_type,
          provider: 'OpenAI', // Default, could be from config
          model: 'gpt-6-luna', // Default
          calls: 0,
          input: 0,
          output: 0,
          cost: 0,
          latency: 0,
          failed: 0,
        })
      }
      
      const entry = dailyMap.get(key)
      entry.calls += run.llm_calls || 0
      entry.failed += run.failed_llm_calls || 0
      entry.input += run.llm_calls * 13000 // rough estimate
      entry.output += run.llm_calls * 1700 // rough estimate
      entry.cost += run.estimated_cost_usd || 0
      entry.latency = run.duration_seconds || 0
    })

    const dailyUsage = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date))

    // Totals
    const totalCalls = dailyUsage.reduce((sum, d) => sum + d.calls, 0)
    const totalFailed = dailyUsage.reduce((sum, d) => sum + d.failed, 0)
    const totalCost = dailyUsage.reduce((sum, d) => sum + d.cost, 0)
    const avgLatency = dailyUsage.length > 0 
      ? dailyUsage.reduce((sum, d) => sum + d.latency, 0) / dailyUsage.length 
      : 0

    return NextResponse.json({
      totals: {
        calls: totalCalls,
        failed: totalFailed,
        failureRate: totalCalls > 0 ? (totalFailed / totalCalls * 100).toFixed(1) + '%' : '0%',
        avgLatency: avgLatency.toFixed(1) + 's',
        cost: '$' + totalCost.toFixed(2),
      },
      daily: dailyUsage,
    })
  } catch (error) {
    console.error('Admin AI usage error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}