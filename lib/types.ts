export type PlanType = 'basic' | 'premium' | 'elite'
export type MemberStatus = 'active' | 'suspended'
export type CheckInMethod = 'qr' | 'manual' | 'app'
export type PaymentStatus = 'paid' | 'failed' | 'refunded'

export interface Member {
  id: string
  user_id: string
  name: string
  email: string
  plan_type: PlanType
  join_date: string
  member_id: string
  role: 'member' | 'admin'
  status: MemberStatus
  created_at: string
}

export interface CheckIn {
  id: string
  member_id: string          // FK → members.id (uuid)
  member_code: string        // the PF-XXXXX code (denormalised for speed)
  member_name: string
  checked_in_at: string
  method: CheckInMethod
}

export interface Payment {
  id: string
  member_id: string          // FK → members.id (uuid)
  member_name: string
  plan_type: PlanType
  amount: number
  paid_at: string
  status: PaymentStatus
}

export interface Plan {
  id: string
  name: string
  slug: PlanType
  price: number
  duration: string
  features: string[]
  highlight: boolean
}

export interface Coach {
  id: string
  name: string
  photo_url: string
  specialties: string[]
  bio: string
  order: number
}

// ---- admin dashboard aggregates ----
export interface OverviewStats {
  totalMembers: number
  activeMembers: number
  suspendedMembers: number
  revenueThisMonth: number
  checkInsToday: number
  planBreakdown: Record<PlanType, number>
}
