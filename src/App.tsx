import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Boxes, Landmark, LayoutDashboard, ShoppingCart, Truck, Users } from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { Btn, Toaster } from './lib/ui'
import Dashboard from './modules/dashboard/Dashboard'
import Sales from './modules/sales/Sales'
import Purchase from './modules/purchase/Purchase'
import Inventory from './modules/inventory/Inventory'
import Parties from './modules/parties/Parties'
import Accounts from './modules/accounts/Accounts'

const tabs = [
  { id: 'dash', label: 'Dashboard', icon: LayoutDashboard, el: Dashboard },
  { id: 'sales', label: 'Sales', icon: ShoppingCart, el: Sales },
  { id: 'purchase', label: 'Purchase', icon: Truck, el: Purchase },
  { id: 'stock', label: 'Inventory', icon: Boxes, el: Inventory },
  { id: 'parties', label: 'Parties', icon: Users, el: Parties },
  { id: 'acc', label: 'Accounts', icon: Landmark, el: Accounts },
]

const Brand = () => <span className="text-2xl font-extrabold">Flow<span className="text-brass">ERP</span></span>

function NavBtn({ t, active, set, col }: { t: (typeof tabs)[number]; active: boolean; set: () => void; col?: boolean }) {
  return (
    <button onClick={set} aria-label={t.label}
      className={'relative flex items-center rounded-xl font-semibold transition-colors ' + (col ? 'flex-1 flex-col gap-0.5 py-2 text-[11px] ' : 'gap-3 px-4 py-3 ') + (active ? 'text-ink' : 'text-mist hover:text-white')}>
      {active && <motion.div layoutId={col ? 'pill-m' : 'pill-d'} className="absolute inset-0 rounded-xl bg-brass" transition={{ type: 'spring', stiffness: 420, damping: 30 }} />}
      <motion.span className="relative" animate={active ? { y: [0, -5, 0] } : { y: 0 }}><t.icon size={col ? 20 : 18} /></motion.span>
      <span className="relative">{t.label}</span>
    </button>
  )
}

export default function App() {
  const [tab, setTab] = useState('dash')
  const [live, setLive] = useState(false)

  // Realtime: any change in any table refreshes every mounted module (debounced)
  useEffect(() => {
    if (!supabaseConfigured) return
    let t = 0
    const ping = () => { clearTimeout(t); t = window.setTimeout(() => window.dispatchEvent(new Event('erp-change')), 300) }
    const ch = supabase.channel('erp-live')
    ;['orders', 'products', 'ledger', 'stock_moves', 'parties'].forEach(table => ch.on('postgres_changes', { event: '*', schema: 'public', table }, ping))
    ch.subscribe(s => setLive(s === 'SUBSCRIBED'))
    return () => { clearTimeout(t); supabase.removeChannel(ch) }
  }, [])

  if (!supabaseConfigured) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 relative">
        <div className="blob fixed pointer-events-none -top-24 left-[15%] w-96 h-96 rounded-full bg-mint/20 blur-3xl" />
        <div className="glass max-w-xl w-full p-6 relative z-10">
          <Brand />
          <p className="text-mist mt-3">Supabase is not configured. Create <code className="text-brass">.env</code> from <code className="text-brass">.env.example</code>, add your project URL and anon key, then restart the dev server.</p>
          <div className="mt-4 text-sm text-mist space-y-1">
            <p>1. Supabase SQL Editor: run <span className="text-brass">schema.sql</span>, <span className="text-brass">02_upgrade.sql</span>, <span className="text-brass">03_grants.sql</span>.</p>
            <p>2. Project Settings → API: copy URL and anon key into <span className="text-brass">.env</span>.</p>
            <p>3. Run <span className="text-brass">npm install</span> and <span className="text-brass">npm run dev</span>.</p>
          </div>
        </div>
        <Toaster />
      </div>
    )
  }

  const Cur = tabs.find(t => t.id === tab)!.el
  const Dot = <span className={'size-2 rounded-full ' + (live ? 'bg-mint animate-pulse' : 'bg-coral')} />

  return (
    <div className="min-h-dvh md:flex relative">
      <div className="blob fixed pointer-events-none -top-24 left-[15%] w-96 h-96 rounded-full bg-mint/20 blur-3xl" />
      <div className="blob fixed pointer-events-none -bottom-24 right-[8%] w-96 h-96 rounded-full bg-brass/15 blur-3xl" style={{ animationDelay: '-8s' }} />
      <nav className="glass hidden md:flex flex-col gap-1 m-3 p-3 w-60 shrink-0 sticky top-3 h-[calc(100dvh-1.5rem)] z-10">
        <motion.div className="px-3 py-4" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}><Brand /></motion.div>
        {tabs.map(t => <NavBtn key={t.id} t={t} active={tab === t.id} set={() => setTab(t.id)} />)}
        <div className="mt-auto px-3 py-2 flex items-center gap-2 text-sm text-mist">{Dot}{live ? 'Live sync on' : 'Offline'}</div>
      </nav>
      <div className="flex-1 min-w-0 relative z-10">
        <header className="md:hidden flex items-center justify-between px-4 pt-4 pt-[calc(1rem+env(safe-area-inset-top))]"><Brand />{Dot}</header>
        <main className="max-w-[1400px] mx-auto p-4 md:p-8 pb-28 md:pb-8">
          <AnimatePresence mode="wait"><Cur key={tab} /></AnimatePresence>
        </main>
      </div>
      <nav className="glass md:hidden fixed bottom-2 inset-x-2 z-40 flex gap-1 p-1.5 bg-panel/90 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
        {tabs.map(t => <NavBtn key={t.id} col t={t} active={tab === t.id} set={() => setTab(t.id)} />)}
      </nav>
      <Toaster />
    </div>
  )
}
