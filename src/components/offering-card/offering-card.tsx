import React, { ReactNode } from 'react'

type Props = {
  title: string
  color: string
  price: string
  type: string
  icon?: ReactNode
  startingAt?: boolean
  rate?: string
}

function OfferingCard({
  title,
  color,
  price,
  type,
  icon,
  startingAt = false,
}: Props) {
  return (
    <div className="max-w-md w-full border-2" style={{ borderColor: color }}>
      <div style={{ backgroundColor: color }}>
        <p className="text-white text-center py-5 text-base">{type}</p>
      </div>
      <div className="flex justify-center p-12">{icon}</div>
      <h2 className="text-center text-4xl" style={{ color }}>
        {title}
      </h2>
      <div className="h-10" />
      <div className="flex justify-center">
        <div
          className="h-0.5 max-w-[275px]"
          style={{ backgroundColor: color }}
        />
      </div>
      {!startingAt ? (
        <div className="h-10" />
      ) : (
        <>
          <div className="h-[13px]" />
          <p className="text-lg text-center" style={{ color }}>
            starting at
          </p>
        </>
      )}
      <p className="text-4xl text-center" style={{ color }}>
        {price}
      </p>
      <p className="text-lg text-center" style={{ color }}>
        per month
      </p>
      <div className="h-10" />
    </div>
  )
}

export default OfferingCard
