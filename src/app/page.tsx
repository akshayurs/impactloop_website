import dynamic from 'next/dynamic'

const MarketingPage = dynamic(() => import('@/components/MarketingPage'), { ssr: false })

export default function Home() {
  return <MarketingPage />
}
