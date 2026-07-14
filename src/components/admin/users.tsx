'use client'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type UserRow = { uid: string; email: string | null; displayName: string | null; admin: boolean; createdAt: string }
type Detail = { profile: { uid: string; email: string | null; displayName: string | null } | null; apps: Array<{ appId: string; data: any }>; payments: any[] }

export function AdminUsers() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [error, setError] = useState(false)
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [trialDays, setTrialDays] = useState(7)
  const [revokeTarget, setRevokeTarget] = useState<{ uid: string; appId: string } | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const res = await adminFetch(user, `/api/admin/users?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('failed')
      setUsers((await res.json()).users)
    } catch {
      setError(true)
    }
  }, [user, q])

  useEffect(() => {
    void load()
  }, [load])

  async function openDetail(uid: string) {
    if (!user) return
    setOpenUid(uid)
    setDetail(null)
    setActionMsg(null)
    const res = await adminFetch(user, `/api/admin/users/${uid}`)
    if (res.ok) setDetail(await res.json())
    else setActionMsg('Failed to load user detail.')
  }

  async function act(uid: string, appId: string, action: 'grant-trial' | 'revoke') {
    if (!user) return
    setActionMsg(null)
    const res = await adminFetch(user, `/api/admin/users/${uid}`, {
      method: 'POST',
      body: JSON.stringify(action === 'grant-trial' ? { action, appId, trialDays } : { action, appId }),
    })
    const data = await res.json().catch(() => ({}))
    setActionMsg(res.ok ? 'Done.' : (data.error ?? 'Action failed.'))
    if (res.ok) await openDetail(uid)
  }

  return (
    <div>
      <div className="flex items-end gap-3">
        <div className="grow">
          <Input label="Search users" placeholder="email, name, or uid" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>Search</Button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-500">Couldn't load users.</p>
      ) : !users ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No users found.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {users.map((u) => (
            <Card key={u.uid} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-fg">{u.displayName ?? u.email ?? u.uid}</p>
                  <p className="text-xs text-muted">{u.email} · joined {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.admin ? <Badge>admin</Badge> : null}
                  <Button variant="outline" size="sm" onClick={() => void openDetail(u.uid)}>
                    {openUid === u.uid ? 'Refresh' : 'Details'}
                  </Button>
                </div>
              </div>

              {openUid === u.uid ? (
                <div className="mt-4 border-t border-line pt-4">
                  {!detail ? (
                    <p className="text-sm text-muted">{actionMsg ?? 'Loading…'}</p>
                  ) : (
                    <>
                      {detail.apps.length === 0 ? <p className="text-sm text-muted">No app entitlements.</p> : null}
                      {detail.apps.map(({ appId, data }) => (
                        <div key={appId} className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm text-fg">
                            <span className="font-medium capitalize">{appId}</span>{' '}
                            <span className="text-muted">
                              {data.subscription
                                ? `${data.subscription.status} · ${data.subscription.tier ?? ''} · ${
                                    data.subscription.expiryTimeMillis === null
                                      ? 'lifetime'
                                      : new Date(data.subscription.expiryTimeMillis).toLocaleDateString()
                                  }`
                                : 'no subscription'}
                              {data.trialUsed ? ' · trial used' : ''}
                            </span>
                          </p>
                          <Button variant="outline" size="sm" onClick={() => setRevokeTarget({ uid: u.uid, appId })}>
                            Revoke
                          </Button>
                        </div>
                      ))}
                      <div className="mt-4 flex flex-wrap items-end gap-3">
                        <div className="w-32">
                          <Input label="Trial days" type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
                        </div>
                        <Button size="sm" onClick={() => void act(u.uid, 'crackloop', 'grant-trial')}>
                          Grant trial (crackloop)
                        </Button>
                      </div>
                      {detail.payments.length > 0 ? (
                        <ul className="mt-4 space-y-1 text-xs text-muted">
                          {detail.payments.map((p) => (
                            <li key={p.id}>
                              {new Date(p.createdAt).toLocaleDateString()} · {p.appId} · {p.type} · {formatINR(p.amountPaise)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {actionMsg ? <p role="status" className="mt-3 text-xs text-muted">{actionMsg}</p> : null}
                    </>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={revokeTarget !== null}
        title="Revoke access?"
        body="This immediately removes the user's entitlements for this app. It does not cancel Razorpay billing."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          if (revokeTarget) void act(revokeTarget.uid, revokeTarget.appId, 'revoke')
          setRevokeTarget(null)
        }}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  )
}
