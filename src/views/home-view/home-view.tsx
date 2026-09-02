import { Fragment } from 'react'
import Faqs from '@/components/faqs/faqs'
import Offerings from './offerings'
import Vision from './vision'
import Hero from './hero'

function HomeView() {
  return (
    <Fragment>
      <Hero />
      <Vision />
      <Offerings />
      <div className="py-24 px-12">
        <div className="max-w-4xl mx-auto">
          <Faqs />
        </div>
      </div>
    </Fragment>
  )
}
export default HomeView
