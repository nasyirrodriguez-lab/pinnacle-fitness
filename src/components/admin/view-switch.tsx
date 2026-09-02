import Link from 'next/link'

// Owners wear two hats. One pill, two halves.
export default function ViewSwitch({
  current,
}: {
  current: 'coach' | 'business'
}) {
  const base =
    'flex-1 text-center px-3 py-1.5 text-xs font-semibold rounded-full transition-colors'
  return (
    <div className="inline-flex w-full p-1 rounded-full bg-neutral-100 border border-neutral-200">
      <Link
        href="/coach"
        className={
          current === 'coach'
            ? `${base} bg-turquoise-500 text-black`
            : `${base} text-neutral-600 hover:text-neutral-900`
        }
      >
        Coach view
      </Link>
      <Link
        href="/admin"
        className={
          current === 'business'
            ? `${base} bg-turquoise-500 text-black`
            : `${base} text-neutral-600 hover:text-neutral-900`
        }
      >
        Business
      </Link>
    </div>
  )
}
