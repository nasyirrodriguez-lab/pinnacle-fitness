'use client'

interface FreeTrialBooking {
  id: string
  name: string
  email: string
  phone: string
  class_name: string
  class_day: string
  class_time: string
  created_at: string
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function FreeTrialSection({ bookings }: { bookings: FreeTrialBooking[] }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-white font-semibold text-lg">Free Trial Bookings</h2>
        <p className="text-zinc-500 text-sm mt-1">{bookings.length} total</p>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-500 text-sm">No free trial bookings yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Class</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Booked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {bookings.map((b) => (
                <tr key={b.id} className="bg-zinc-950 hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell">{b.email}</td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{b.phone}</td>
                  <td className="px-4 py-3">
                    <span className="text-zinc-200">{b.class_name}</span>
                    <span className="text-zinc-500 ml-2 text-xs">{b.class_day} {formatTime(b.class_time)}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                    {new Date(b.created_at).toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
