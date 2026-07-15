'use client'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import { APPS } from '@/config/apps'
import { useAuth } from '@/lib/auth-context'
import { adminFetch } from './admin-fetch'

type UserRow = { uid: string; email: string | null; displayName: string | null; admin: boolean; createdAt: string }
type Detail = { profile: { uid: string; email: string | null; displayName: string | null } | null; apps: Array<{ appId: string; data: any }>; payments: any[] }

export function AdminUsers() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [error, setError] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [trialDays, setTrialDays] = useState(7)
  const [trialApp, setTrialApp] = useState(APPS[0]?.id ?? 'crackloop')
  const [revokeTarget, setRevokeTarget] = useState<{ uid: string; appId: string } | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    setLoadMoreError(false)
    try {
      const res = await adminFetch(user, `/api/admin/users?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setUsers(data.users)
      setNextCursor(data.nextCursor ?? null)
    } catch {
      setError(true)
    }
  }, [user, q])

  useEffect(() => {
    void load()
  }, [load])

  async function loadMore() {
    if (!user || !nextCursor) return
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const res = await adminFetch(user, `/api/admin/users?cursor=${encodeURIComponent(nextCursor)}&q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setUsers((prev) => {
        const existing = new Set((prev ?? []).map((u) => u.uid))
        const additions = (data.users as UserRow[]).filter((u) => !existing.has(u.uid))
        return [...(prev ?? []), ...additions]
      })
      setNextCursor(data.nextCursor ?? null)
    } catch {
      setLoadMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

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
        <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading users">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl border-2 border-line-strong" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card className="mt-4 rounded-2xl border-2 border-line-strong text-center">
          <p className="text-sm text-muted">No users match that search.</p>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {users.map((u) => (
            <Card key={u.uid} className="rounded-2xl border-2 border-line-strong p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-fg">{u.displayName ?? u.email ?? u.uid}</p>
                  <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.1em] text-muted">
                    {u.email} · joined {new Date(u.createdAt).toLocaleDateString()}
                  </p>
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
                    <div className="skeleton h-12 rounded-lg" aria-busy="true" aria-label="Loading detail" />
                  ) : (
                    <>
                      {detail.apps.length === 0 ? <p className="text-sm text-muted">No app entitlements.</p> : null}
                      {detail.apps.map(({ appId, data }) => (
                        <div key={appId} className="mt-3 rounded-xl border border-line p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-fg">
                              {appId}
                              {data.subscription ? (
                                <Badge
                                  tone={
                                    data.subscription.status === 'active' || data.subscription.status === 'lifetime'
                                      ? 'success'
                                      : data.subscription.status === 'trial'
                                        ? 'default'
                                        : 'warn'
                                  }
                                >
                                  {data.subscription.status}
                                </Badge>
                              ) : (
                                <Badge tone="warn">no subscription</Badge>
                              )}
                              {data.trialUsed ? <Badge>trial used</Badge> : null}
                            </p>
                            <Button variant="outline" size="sm" onClick={() => setRevokeTarget({ uid: u.uid, appId })}>
                              Revoke
                            </Button>
                          </div>
                          {data.subscription ? (
                            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
                              <div>
                                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Plan id</dt>
                                <dd className="mt-0.5 truncate font-mono text-xs text-fg" title={data.subscription.planId}>
                                  {data.subscription.planId ?? '—'}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Tier</dt>
                                <dd className="mt-0.5 text-sm text-fg">{data.subscription.tier ?? '—'}</dd>
                              </div>
                              <div>
                                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                                  {data.subscription.expiryTimeMillis === null
                                    ? 'Access'
                                    : data.subscription.autoRenewing
                                      ? 'Renews'
                                      : 'Expires'}
                                </dt>
                                <dd className="mt-0.5 text-sm text-fg">
                                  {data.subscription.expiryTimeMillis === null
                                    ? 'Lifetime'
                                    : new Date(data.subscription.expiryTimeMillis).toLocaleString()}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Auto-renew</dt>
                                <dd className="mt-0.5 text-sm text-fg">{data.subscription.autoRenewing ? 'On' : 'Off'}</dd>
                              </div>
                              <div>
                                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Last verified</dt>
                                <dd className="mt-0.5 text-sm text-fg">
                                  {data.subscription.lastVerifiedAt
                                    ? new Date(data.subscription.lastVerifiedAt).toLocaleString()
                                    : '—'}
                                </dd>
                              </div>
                            </dl>
                          ) : null}
                        </div>
                      ))}
                      <div className="mt-4 flex flex-wrap items-end gap-3">
                        <div className="flex w-36 flex-col gap-1.5">
                          <label htmlFor={`trial-app-${u.uid}`} className="font-mono text-xs uppercase tracking-[0.14em] text-fg">App</label>
                          <select
                            id={`trial-app-${u.uid}`}
                            value={trialApp}
                            onChange={(e) => setTrialApp(e.target.value)}
                            className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-fg"
                          >
                            {APPS.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                          </select>
                        </div>
                        <div className="w-32">
                          <Input label="Trial days" type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
                        </div>
                        <Button size="sm" onClick={() => void act(u.uid, trialApp, 'grant-trial')}>
                          Grant trial
                        </Button>
                      </div>
                      {detail.payments.length > 0 ? (
                        <ul className="mt-4 space-y-1 font-mono text-xs text-muted">
                          {detail.payments.map((p) => (
                            <li key={p.id}>
                              {new Date(p.createdAt).toLocaleDateString()} · {p.appId} · {p.type} · {formatINR(p.amountPaise)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {actionMsg ? <p role="status" className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-muted">{actionMsg}</p> : null}
                    </>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {loadMoreError ? (
        <p role="alert" className="mt-4 text-center text-sm text-red-500">Couldn't load more users.</p>
      ) : null}
      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}

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
