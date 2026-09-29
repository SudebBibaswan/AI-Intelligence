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
    const entityType = searchParams.get('entity_type')
    const activityStatus = searchParams.get('activity_status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    let query = supabase
      .from('v_capital_directory')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('activity_status', { ascending: false })
      .order('last_capital_activity_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (entityType) {
      query = query.eq('entity_type', entityType)
    }
    if (activityStatus) {
      query = query.eq('activity_status', activityStatus)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data, count: data?.length || 0 })
  } catch (error) {
    console.error('Capital Directory API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}