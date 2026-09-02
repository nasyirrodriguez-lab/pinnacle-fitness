import { createAdminClient } from '@/utils/supabase/admin'
import { loadGymSettings } from '@/lib/gym/settings'
import GymSettingsForm from '@/components/admin/gym-settings-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings — Admin' }

export default async function AdminSettingsPage() {
  const settings = await loadGymSettings(createAdminClient())
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-1">Settings</h1>
        <p className="text-neutral-600 max-w-xl">The numbers that run the door and the rules. Change them here, not in code — they apply on the next scan.</p>
      </div>
      <div className="bg-white border border-neutral-200 rounded-lg p-6 max-w-3xl">
        <GymSettingsForm settings={settings} />
      </div>
    </div>
  )
}
