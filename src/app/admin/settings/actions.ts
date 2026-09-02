'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import { assertOwner } from '@/lib/auth/assert'
import { saveGymSetting, type GymSettings } from '@/lib/gym/settings'

const schema = z.object({
  floorCap: z.number().int().min(1).max(200),
  autoSignoutHours: z.number().int().min(1).max(12),
  ptCancelHours: z.number().int().min(0).max(48),
  noShowMinutes: z.number().int().min(5).max(240),
  checkinEarlyMinutes: z.number().int().min(0).max(120),
  checkinLateMinutes: z.number().int().min(0).max(120),
  lapseGraceDays: z.number().int().min(0).max(30),
  rentTargetCents: z.number().int().min(0).max(1_000_000_000),
})

export async function adminSaveGymSettings(
  input: z.infer<typeof schema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await assertOwner()
  if ('error' in auth) return { ok: false, error: auth.error }
  let data
  try {
    data = schema.parse(input)
  } catch (err) {
    const msg =
      err instanceof z.ZodError ? (err.issues[0]?.message ?? 'Invalid') : 'Invalid'
    return { ok: false, error: msg }
  }
  const admin = createAdminClient()
  for (const [field, value] of Object.entries(data) as [keyof GymSettings, number][]) {
    const ok = await saveGymSetting(admin, field, value)
    if (!ok) return { ok: false, error: `Could not save ${field}` }
  }
  revalidatePath('/admin/settings')
  revalidatePath('/admin')
  return { ok: true }
}
