import PageHeader from '@/components/page-header/page-header'
import { Inquire } from '@/components/ctas/ctas'
import { PropsWithChildren } from 'react'

export interface PricingItem {
  id: string
  name: string
  description: string
  price?: number
  priceSuffix?: string
  features: string[]
  specialized?: boolean
}

const formatPrice = (price: number): string => {
  if (price === 0) return 'Free'
  const formattedPrice = price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return `${formattedPrice} TTD`
}

const PALETTE_COLORS: Record<string, string> = {
  lime: 'var(--color-lime-100)',
  turquoise: 'var(--color-turquoise-100)',
  darkOrange: 'var(--color-darkOrange-100)',
}

function PriceSection({ children }: PropsWithChildren) {
  return <div className="mb-8 last:mb-0">{children}</div>
}

function PriceSectionHeading({ children }: PropsWithChildren) {
  return <h2 className="my-8 text-4xl">{children}</h2>
}

function PriceGrid({ children }: PropsWithChildren) {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
      {children}
    </div>
  )
}

function PriceCard({
  name,
  price,
  priceSuffix,
  description,
  features,
  specialized,
  colorPalette,
}: PricingItem & { colorPalette: string }) {
  const bgColor = PALETTE_COLORS[colorPalette] || PALETTE_COLORS.lime

  return (
    <div className="bg-white border-2 border-neutral-200">
      <div className="p-6">
        <div className="flex items-center gap-2 justify-between flex-wrap">
          <h3 className="text-sm py-1">
            {name}
            {specialized && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-darkBlue-100 text-darkBlue-900">
                Specialized
              </span>
            )}
          </h3>
          {price != null && price > 0 && (
            <span
              className="px-4 py-1 text-sm font-bold"
              style={{ backgroundColor: bgColor }}
            >
              {formatPrice(price)}
              {priceSuffix ?? ''}
            </span>
          )}
        </div>
      </div>
      <div className="px-6 pb-6">
        <p className="mb-2 text-sm">{description}</p>
        <div className="flex flex-wrap">
          {features.map((feature) => (
            <span
              key={feature}
              className="px-2 py-1 mr-2 mb-2 bg-neutral-50 text-sm rounded-xs"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface PricingViewProps {
  plans: PricingItem[]
  passes: PricingItem[]
  bookings: PricingItem[]
}

export default function PricingView({
  plans,
  passes,
  bookings,
}: PricingViewProps) {
  return (
    <div>
      <PageHeader
        title="Pricing"
        description="Choose a plan that fits your needs. Whether you're looking for a flexible coworking space or a dedicated office, we have options to suit every professional."
        image={{
          src: '/images/conf-2.jpg',
          alt: 'Flexible pricing plans at The Worx coworking space',
        }}
      />
      <div className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-12">
          <PriceSection>
            <PriceSectionHeading>Plans</PriceSectionHeading>
            <PriceGrid>
              {plans.map((plan) => (
                <PriceCard key={plan.id} {...plan} colorPalette="lime" />
              ))}
            </PriceGrid>
          </PriceSection>
          <PriceSection>
            <PriceSectionHeading>Passes</PriceSectionHeading>
            <PriceGrid>
              {passes.map((pass) => (
                <PriceCard key={pass.id} {...pass} colorPalette="turquoise" />
              ))}
            </PriceGrid>
          </PriceSection>
          <PriceSection>
            <PriceSectionHeading>Bookings</PriceSectionHeading>
            <PriceGrid>
              {bookings.map((booking) => (
                <PriceCard
                  key={booking.id}
                  {...booking}
                  colorPalette="darkOrange"
                />
              ))}
            </PriceGrid>
          </PriceSection>
        </div>
      </div>
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-12 text-center">
          <h2 className="text-2xl mb-4">Have questions about pricing?</h2>
          <p className="mb-6 text-neutral-600">
            Reach out and we&apos;ll help you find the right plan.
          </p>
          <Inquire />
        </div>
      </div>
    </div>
  )
}
