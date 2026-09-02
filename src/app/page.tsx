import type { Metadata } from 'next'
import HomeView from '@/views/home-view/home-view'

export const metadata: Metadata = {
  title: 'Pinnacle Fitness — Train with us',
  description:
    'A members-only coached gym at The Playground, Port of Spain. Small-group PT with Nasyir and Matthew, open gym on the turf, membership by application.',
}

export default function Home() {
  return <HomeView />
}
