import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const fallbackClasses = [
  { id: 'f1', name: 'Morning HIIT', coach_name: 'Nasyir Rodriguez', day_of_week: 'Monday', start_time: '05:30:00', duration_min: 60, location: 'Outdoor', max_spots: 20 },
  { id: 'f2', name: 'Strength & Conditioning', coach_name: 'Matthew Sirjoo', day_of_week: 'Monday', start_time: '17:00:00', duration_min: 60, location: 'Outdoor', max_spots: 20 },
  { id: 'f3', name: 'Morning HIIT', coach_name: 'Nasyir Rodriguez', day_of_week: 'Wednesday', start_time: '05:30:00', duration_min: 60, location: 'Outdoor', max_spots: 20 },
  { id: 'f4', name: 'Strength & Conditioning', coach_name: 'Matthew Sirjoo', day_of_week: 'Wednesday', start_time: '17:00:00', duration_min: 60, location: 'Outdoor', max_spots: 20 },
  { id: 'f5', name: 'Morning HIIT', coach_name: 'Nasyir Rodriguez', day_of_week: 'Friday', start_time: '05:30:00', duration_min: 60, location: 'Outdoor', max_spots: 20 },
  { id: 'f6', name: 'Strength & Conditioning', coach_name: 'Matthew Sirjoo', day_of_week: 'Friday', start_time: '17:00:00', duration_min: 60, location: 'Outdoor', max_spots: 20 },
  { id: 'f7', name: 'Saturday Session', coach_name: 'Nasyir Rodriguez', day_of_week: 'Saturday', start_time: '07:00:00', duration_min: 60, location: 'Outdoor', max_spots: 20 },
]

export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('classes')
      .select('*')
      .order('day_of_week')
      .order('start_time')

    if (!error && data && data.length > 0) {
      return NextResponse.json({ classes: data })
    }
  } catch {
    // fall through to fallback
  }

  return NextResponse.json({ classes: fallbackClasses })
}
