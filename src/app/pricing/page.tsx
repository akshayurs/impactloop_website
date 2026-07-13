import dynamic from 'next/dynamic'
const Pricing = dynamic(() => import('@/components/Pricing'), { ssr: false })
export default function PricingPage() {
  return <Pricing />
}
