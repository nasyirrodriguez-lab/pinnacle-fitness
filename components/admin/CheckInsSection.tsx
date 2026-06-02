'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { CheckIn } from '@/lib/types'

const QRScanner = dynamic(() => import('./QRScanner'), { ssr: false })

interface ScanResult {
  type: 'success' | 'error' | 'suspended'
  message: string
  memberName?: string
}

const methodBadge: Record<string, string> = {
  qr: 'bg-orange-500/20 text-orange-300 border border-orange-500/25',
  manual: 'bg-zinc-700 text-zinc-300',
  app: 'bg-blue-500/20 text-blue-300 border border-blue-500/25',
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function CheckInsSection({ initialCheckIns }: { initialCheckIns: CheckIn[] }) {
  const [checkIns, setCheckIns] = useState<CheckIn[]>(initialCheckIns)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScanned = useRef<string>('')
  const supabase = createClient()

  // Realtime subscription
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]

    const channel = supabase
      .channel('check_ins_live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'check_ins',
          filter: `checked_in_at=gte.${today}T00:00:00`,
        },
        (payload) => {
          setCheckIns((prev) => [payload.new as CheckIn, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  function showResult(r: ScanResult) {
    setResult(r)
    if (resultTimer.current) clearTimeout(resultTimer.current)
    resultTimer.current = setTimeout(() => setResult(null), 4000)
  }

  async function logCheckIn(code: string, method: 'qr' | 'manual') {
    if (!code.trim()) return
    setScanning(true)
    try {
      const res = await fetch('/api/admin/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberCode: code.trim(), method }),
      })
      const json = await res.json()
      if (res.status === 404) showResult({ type: 'error', message: `No member found for code "${code}"` })
      else if (res.status === 403) showResult({ type: 'suspended', message: `${json.member?.name ?? code} is suspended`, memberName: json.member?.name })
      else if (!res.ok) showResult({ type: 'error', message: json.error ?? 'Unknown error' })
      else showResult({ type: 'success', message: `Checked in: ${json.member?.name}`, memberName: json.member?.name })
    } catch {
      showResult({ type: 'error', message: 'Network error' })
    } finally {
      setScanning(false)
    }
  }

  const handleQRScan = useCallback((code: string) => {
    // Debounce repeat scans of the same code within 3 seconds
    if (code === lastScanned.current) return
    lastScanned.current = code
    setTimeout(() => { lastScanned.current = '' }, 3000)
    logCheckIn(code, 'qr')
  }, [])

  async function handleManual(e: React.FormEvent) {
    e.preventDefault()
    await logCheckIn(manualCode, 'manual')
    setManualCode('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Check-Ins</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Live log — {checkIns.length} check-in{checkIns.length !== 1 ? 's' : ''} today
            <span className="ml-2 inline-flex items-center gap-1 text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              live
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Scanner panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">QR Scanner</h3>
              <button
                onClick={() => setScannerOpen((o) => !o)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  scannerOpen
                    ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    : 'bg-orange-500 text-white hover:bg-orange-400'
                }`}
              >
                {scannerOpen ? 'Close Camera' : 'Open Camera'}
              </button>
            </div>

            {scannerOpen && (
              <div className="mb-4">
                <QRScanner onScan={handleQRScan} active={scannerOpen} />
              </div>
            )}

            {/* Scan result feedback */}
            {result && (
              <div className={`rounded-lg px-4 py-3 text-sm font-medium mb-4 transition-all ${
                result.type === 'success'
                  ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                  : result.type === 'suspended'
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                  : 'bg-red-500/15 border border-red-500/30 text-red-400'
              }`}>
                {result.type === 'success' && '✓ '}
                {result.type === 'suspended' && '⚠ '}
                {result.type === 'error' && '✗ '}
                {result.message}
              </div>
            )}

            {/* Manual entry */}
            <div>
              <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Manual Entry</p>
              <form onSubmit={handleManual} className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="PF-XXXXXXX"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 font-mono focus:border-orange-500 focus:outline-none transition uppercase"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || scanning}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-50 transition-colors"
                >
                  {scanning ? '…' : 'Log'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Live log */}
        <div className="lg:col-span-3 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">Today's Log</h3>
            <span className="text-xs text-zinc-600">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>

          {checkIns.length === 0 ? (
            <div className="py-16 text-center text-zinc-600 text-sm">No check-ins yet today.</div>
          ) : (
            <div className="overflow-y-auto max-h-[480px] divide-y divide-zinc-800">
              {checkIns.map((ci) => (
                <div key={ci.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-800/40 transition-colors">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">
                    {ci.member_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{ci.member_name}</p>
                    <p className="text-xs text-zinc-500 font-mono">{ci.member_code}</p>
                  </div>
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${methodBadge[ci.method] ?? methodBadge.manual}`}>
                      {ci.method}
                    </span>
                    <span className="text-xs text-zinc-600">{timeLabel(ci.checked_in_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
