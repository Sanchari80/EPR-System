import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useState } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import { Check, Search as SearchIcon, X } from 'lucide-react'

export const money = (n: number) => '৳' + n.toLocaleString('en-US', { maximumFractionDigits: 2 })
export const notify = (m: string, ok = true) => window.dispatchEvent(new CustomEvent('toast', { detail: { m, ok } }))

export function csv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return notify('Nothing to export', false)
  const keys = Object.keys(rows[0])
  const body = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' })); a.download = name + '.csv'; a.click()
}

type Res<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>
// Loads data, and reloads whenever Supabase Realtime reports a change (event 'erp-change')
export function useQuery<T>(fn: () => Res<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const load = useCallback(async () => {
    const r = await fn()
    if (r.error) notify(r.error.message, false)
    setData(r.data)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load(); window.addEventListener('erp-change', load)
    return () => window.removeEventListener('erp-change', load)
  }, [load])
  return { data, reload: load }
}

function useMobile() {
  const q = '(max-width: 767px)'
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => { const mq = window.matchMedia(q), h = () => setM(mq.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h) }, [])
  return m
}

export function Num({ v, money: m = true }: { v: number; money?: boolean }) {
  const [x, setX] = useState(0)
  useEffect(() => { const c = animate(0, v, { duration: 1.1, ease: 'easeOut', onUpdate: setX }); return () => c.stop() }, [v])
  const r = Math.round(x * 100) / 100
  return <>{m ? money(r) : r}</>
}

export const Btn = ({ ghost, className, ...p }: ComponentProps<typeof motion.button> & { ghost?: boolean }) => (
  <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} {...p}
    className={'px-4 py-2 rounded-xl font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2 ' + (ghost ? 'bg-white/10 text-white ' : 'bg-brass text-ink shadow-lg shadow-brass/20 ') + (className ?? '')} />
)

export const Page = ({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) => (
  <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -28 }} transition={{ duration: 0.35 }}>
    <div className="flex items-end justify-between gap-3 flex-wrap mb-5 md:mb-6">
      <div className="min-w-0"><h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{title}</h1>{sub && <p className="text-mist mt-1 text-sm md:text-base">{sub}</p>}</div>
      <div className="flex gap-2 flex-wrap items-center">{action}</div>
    </div>
    {children}
  </motion.div>
)

export const Stat = ({ label, v, glow, i = 0, money: m = true }: { label: string; v: number; glow: string; i?: number; money?: boolean }) => (
  <motion.div className="glass p-4 md:p-5 relative overflow-hidden" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 18 }} whileHover={{ y: -5 }}>
    <div className={'absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-40 ' + glow} />
    <p className="text-mist text-xs md:text-sm relative">{label}</p>
    <p className="text-xl md:text-2xl font-bold mt-1 relative truncate"><Num v={v} money={m} /></p>
  </motion.div>
)

export const Search = ({ v, set }: { v: string; set: (s: string) => void }) => (
  <div className="relative flex-1 min-w-40">
    <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
    <input className="inp pl-9" placeholder="Search…" value={v} onChange={e => set(e.target.value)} aria-label="Search" />
  </div>
)

const Head = createContext<string[]>([])
export const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <Head.Provider value={head}>
    <div className="glass overflow-x-auto"><table className="rt w-full text-left">
      <thead className="text-mist text-sm"><tr>{head.map((h, i) => <th key={i} className="p-3 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{children}</tbody></table></div>
  </Head.Provider>
)

export function Row({ i, children, onClick }: { i: number; children: ReactNode; onClick?: () => void }) {
  const head = useContext(Head)
  return (
    <motion.tr onClick={onClick} className={'border-t border-white/5 hover:bg-white/5 ' + (onClick ? 'cursor-pointer' : '')}
      initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.035 }} whileTap={onClick ? { scale: 0.99 } : undefined}>
      {Children.map(children, (c, k) => (isValidElement(c) ? cloneElement(c as ReactElement<{ 'data-label'?: string }>, { 'data-label': head[k] }) : c))}
    </motion.tr>
  )
}

// Centered dialog on desktop, bottom sheet on phones
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const mobile = useMobile()
  const pop = mobile
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { scale: 0.85, y: 50, opacity: 0 }, animate: { scale: 1, y: 0, opacity: 1 }, exit: { scale: 0.95, y: 20, opacity: 0 } }
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div {...pop} transition={{ type: 'spring', damping: 26, stiffness: 280 }} onClick={e => e.stopPropagation()}
            className="glass bg-panel w-full md:max-w-2xl max-h-[92dvh] overflow-auto p-5 md:p-6 rounded-b-none md:rounded-b-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 md:hidden" />
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">{title}</h3><button onClick={onClose} aria-label="Close"><X /></button></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Toaster() {
  const [t, setT] = useState<{ id: number; m: string; ok: boolean }[]>([])
  useEffect(() => {
    const h = (e: Event) => {
      const { m, ok } = (e as CustomEvent).detail, id = Date.now() + Math.random()
      setT(x => [...x, { id, m, ok }]); setTimeout(() => setT(x => x.filter(i => i.id !== id)), 3800)
    }
    window.addEventListener('toast', h); return () => window.removeEventListener('toast', h)
  }, [])
  return (
    <div className="fixed bottom-24 md:bottom-5 inset-x-3 md:inset-x-auto md:right-5 z-[60] space-y-2 md:max-w-sm">
      <AnimatePresence>{t.map(i => (
        <motion.div key={i.id} layout initial={{ y: 40, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ x: 90, opacity: 0 }}
          className={'glass bg-panel px-4 py-3 flex items-center gap-3 ' + (i.ok ? 'border-mint/50' : 'border-coral/60')}>
          <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.1 }} className={i.ok ? 'text-mint' : 'text-coral'}>
            {i.ok ? <Check size={18} /> : <X size={18} />}
          </motion.span>{i.m}
        </motion.div>))}
      </AnimatePresence>
    </div>
  )
}
