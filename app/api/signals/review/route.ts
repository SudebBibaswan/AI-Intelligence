import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { signal_id, decision, request_id, reason } = body

    if (!signal_id || !decision || !request_id) {
      return NextResponse.json({ error: 'signal_id, decision, request_id required' }, { status: 400 })
    }

    if (!['accepted', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be accepted or rejected' }, { status: 400 })
    }

    if (decision === 'rejected' && (!reason || !reason.trim())) {
      return NextResponse.json({ error: 'reason required for rejection' }, { status: 400 })
    }

    // Use the database function for proper validation and audit logging
    const { data, error } = await supabase.rpc('review_intelligence_signal', {
      p_signal_id: signal_id,
      p_decision: decision,
      p_reason: reason?.trim() || null,
      p_request_id: request_id
    })

    if (error) {
      // Handle specific error codes
      if (error.message?.includes('SIGNAL_REQUIRES_LINKED_EVIDENCE')) {
        return NextResponse.json({ error: 'Cannot accept signal without linked evidence' }, { status: 400 })
      }
      if (error.message?.includes('SIGNAL_REQUIRES_CURRENT_VERIFIED_EVIDENCE')) {
        return NextResponse.json({ error: 'Signal requires current verified evidence from accepted sources' }, { status: 400 })
      }
      if (error.message?.includes('SUPERSEDED_SIGNAL_CANNOT_BE_REVIEWED')) {
        return NextResponse.json({ error: 'Superseded signals cannot be reviewed' }, { status: 400 })
      }
      if (error.message?.includes('SIGNAL_NOT_FOUND')) {
        return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
      }
      if (error.message?.includes('AUTHENTICATED_REVIEWER_REQUIRED') || error.message?.includes('SIGNAL_REVIEW_NOT_AUTHORIZED')) {
        return NextResponse.json({ error: 'Not authorized to review this signal' }, { status: 403 })
      }
      if (error.message?.includes('REVIEW_REQUEST_ID_CONFLICT')) {
        return NextResponse.json({ error: 'Request ID conflict with existing review' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({
      review_id: data.review_id,
      signal_id: data.signal_id,
      previous_status: data.previous_status,
      decision: data.decision,
      evidence_count: data.evidence_count,
      source_count: data.source_count,
      corroboration_status: data.corroboration_status,
      replayed: data.replayed
    })
  } catch (error) {
    console.error('Signal review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}