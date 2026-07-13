import dynamic from 'next/dynamic'
const AccountView = dynamic(() => import('@/components/AccountView'), { ssr: false })
export default function AccountPage() {
  return <AccountView />
}
