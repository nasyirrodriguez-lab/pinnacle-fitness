export type PlanType = 'basic' | 'premium' | 'elite'

export interface Member {
  id: string
  user_id: string
  name: string
  email: string
  plan_type: PlanType
  join_date: string
  member_id: string
  role: 'member' | 'admin'
}
