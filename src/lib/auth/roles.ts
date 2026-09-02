// Who can do what. 'admin' is a legacy superset alias kept so existing
// accounts and checks keep working; owners are the real top role.
export type Role = 'member' | 'coach' | 'owner' | 'staff' | 'admin'

export const ROLES: Role[] = ['member', 'coach', 'owner', 'staff', 'admin']

export function hasRole(role: string | null | undefined, ...allowed: Role[]) {
  return Boolean(role) && allowed.includes(role as Role)
}

// Runs the gym: coaches and owners (and legacy admins).
export function isTeam(role: string | null | undefined): boolean {
  return hasRole(role, 'coach', 'owner', 'admin')
}

// The business portal: owners only.
export function isOwner(role: string | null | undefined): boolean {
  return hasRole(role, 'owner', 'admin')
}

// The front desk: can check people in and sell, sees no money.
export function isStaff(role: string | null | undefined): boolean {
  return hasRole(role, 'staff', 'coach', 'owner', 'admin')
}

export const ROLE_LABEL: Record<Role, string> = {
  member: 'Member',
  coach: 'Coach',
  owner: 'Owner',
  staff: 'Front desk',
  admin: 'Admin',
}
