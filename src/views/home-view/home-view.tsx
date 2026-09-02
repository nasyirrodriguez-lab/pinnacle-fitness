import { Fragment } from 'react'
import Inclusions from '@/components/inclusions/inclusions'
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
      <Inclusions />
      <div className="py-24 px-12">
        <div className="max-w-4xl mx-auto">
          <Faqs />
        </div>
      </div>
    </Fragment>
  )
}
export default HomeView
