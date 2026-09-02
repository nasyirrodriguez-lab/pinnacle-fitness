'use client'

import Image from 'next/image'
import DirectionsButton from '@/components/directions-button/directions-button'
import { LOCATION } from '@/config/location'

function ContactView() {
  return (
    <div>
      <div className="bg-neutral-50 px-6 md:px-12 py-12 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h1 className="inline-block mb-6 py-2 px-4 text-white bg-neutral-900 text-2xl md:text-3xl">
                Get In Touch
              </h1>
              <div className="flex flex-col items-start gap-4">
                <div>
                  <h3 className="font-bold text-neutral-900">Address</h3>
                  <p className="text-neutral-900">
                    {LOCATION.streetLine1}
                    {LOCATION.streetLine2 && (
                      <>
                        <br />
                        {LOCATION.streetLine2}
                      </>
                    )}
                    <br />
                    {LOCATION.city}
                    <br />
                    {LOCATION.country}
                  </p>
                  <div className="mt-3">
                    <DirectionsButton variant="subtle" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900">Email</h3>
                  <p className="text-neutral-900">team@theworx.io</p>
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900">Phone</h3>
                  <p className="text-neutral-900">+1 (868) 281-0830</p>
                </div>
              </div>
            </div>
            <div>
              <div className="bg-white p-8 rounded-md">
                <div className="flex flex-col items-start gap-6">
                  <div>
                    <h3 className="text-lg font-bold mb-2 text-neutral-900">
                      Opening Hours
                    </h3>
                    <p className="text-neutral-900 font-bold">
                      9:00 AM &mdash; 5:00 PM
                    </p>
                    <p className="text-neutral-600">Monday &mdash; Friday</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold mb-2 text-neutral-900">
                      Visit Us Today
                    </h3>
                    <p className="text-neutral-600 mb-3">
                      Pop by and our friendly staff will greet you and show you
                      around the space.
                    </p>
                    <p className="text-neutral-900 font-medium">
                      We&apos;re located on Level 2 &mdash; security can easily
                      help you find us!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative h-[480px] lg:h-[640px]">
        <Image
          src="/images/main-floor-2.jpg"
          alt="The Worx coworking space in Port of Spain, Trinidad"
          fill
          className="object-cover"
        />
      </div>
    </div>
  )
}

export default ContactView
