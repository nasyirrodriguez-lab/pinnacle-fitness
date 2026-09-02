import WorxIcon from '@/components/logo/icon'
import { BookNow } from '@/components/ctas/ctas'

export default function Vision() {
  return (
    <div className="py-24 px-4 bg-neutral-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-[auto] lg:grid-cols-[max-content_1fr] gap-8 lg:gap-24 justify-items-center">
          <div>
            <WorxIcon size={64} className="text-primary lg:w-32 lg:h-32" />
          </div>
          <div>
            <p className="text-white text-xl lg:text-3xl font-bold text-center lg:text-left">
              Welcome to The Worx &mdash; a space that brings people together,
              is rooted in trust and collaboration, and allows people to
              interact successfully and grow together.
            </p>
            <div className="mt-8 lg:mt-12">
              <div className="flex gap-2 justify-center lg:justify-start">
                <BookNow label="Book a Seat" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
