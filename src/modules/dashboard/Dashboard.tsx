import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Page, Stat, money, useQuery } from '../../lib/ui'
import type { Balance, Daily, Order, Product, TopProd } from '../../lib/types'

const H = 150
const dayName = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en', { weekday: 'short' })

export default function Dashboard() {
  const orders = useQuery<Order[]>(() => supabase.from('orders').select('*')).data ?? []
  const products = useQuery<Product[]>(() => supabase.from('products').select('*')).data ?? []
  const bal = useQuery<Balance[]>(() => supabase.from('account_balances').select('*')).data ?? []
  const daily = useQuery<Daily[]>(() => supabase.from('daily_totals').select('*')).data ?? []
  const top = useQuery<TopProd[]>(() => supabase.from('top_products').select('*')).data ?? []

  const sum = (t: string) => orders.filter(o => o.type === t).reduce((a, o) => a + o.total, 0)
  const nat = (code: string) => { const x = bal.find(b => b.code === code); return !x ? 0 : x.type === 'asset' || x.type === 'expense' ? x.debit - x.credit : x.credit - x.debit }
  const profit = bal.filter(x => x.type === 'income').reduce((a, x) => a + x.credit - x.debit, 0) - bal.filter(x => x.type === 'expense').reduce((a, x) => a + x.debit - x.credit, 0)
  const max = Math.max(1, ...daily.flatMap(d => [d.sales, d.purchases]))
  const tmax = Math.max(1, ...top.map(t => t.qty))
  const low = products.filter(p => p.stock <= p.reorder_level)

  return (
    <Page title="Dashboard" sub="One live view across sales, purchases, stock and accounts">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        <Stat i={0} label="Total sales" v={sum('sale')} glow="bg-brass" />
        <Stat i={1} label="Total purchases" v={sum('purchase')} glow="bg-mint" />
        <Stat i={2} label="Net profit" v={profit} glow="bg-fuchsia-400" />
        <Stat i={3} label="Cash in hand" v={nat('1000')} glow="bg-sky-400" />
        <Stat i={4} label="Customers owe you" v={nat('1100')} glow="bg-emerald-400" />
        <Stat i={5} label="You owe suppliers" v={nat('2000')} glow="bg-coral" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="glass p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h3 className="font-bold">Last 7 days</h3>
            <div className="flex gap-4 text-sm text-mist"><span><i className="inline-block size-2 rounded-full bg-brass mr-1" />Sales</span><span><i className="inline-block size-2 rounded-full bg-mint mr-1" />Purchases</span></div>
          </div>
          <div className="flex items-end gap-1 sm:gap-3" style={{ height: H + 24 }}>
            {daily.map((d, i) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="flex items-end gap-1 w-full justify-center" style={{ height: H }}>
                  <motion.div title={money(d.sales)} className="w-full max-w-6 rounded-t-md bg-brass" initial={{ height: 0 }} animate={{ height: (d.sales / max) * H }} transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: 'easeOut' }} />
                  <motion.div title={money(d.purchases)} className="w-full max-w-6 rounded-t-md bg-mint" initial={{ height: 0 }} animate={{ height: (d.purchases / max) * H }} transition={{ duration: 0.9, delay: 0.3 + i * 0.08, ease: 'easeOut' }} />
                </div>
                <span className="text-xs text-mist">{dayName(d.day)}</span>
              </div>))}
          </div>
        </div>
        <div className="glass p-5">
          <h3 className="font-bold mb-4">Best sellers</h3>
          {top.length === 0 && <p className="text-mist">Sell something to see your top products.</p>}
          {top.map((t, i) => (
            <div key={t.id} className="mb-4 last:mb-0">
              <div className="flex justify-between text-sm mb-1"><span className="truncate">{t.name}</span><span className="font-bold">{t.qty} sold</span></div>
              <div className="h-2.5 rounded-full bg-white/5 overflow-hidden"><motion.div className="h-full rounded-full bg-brass" initial={{ width: 0 }} animate={{ width: (t.qty / tmax) * 100 + '%' }} transition={{ duration: 1, delay: 0.3 + i * 0.1 }} /></div>
            </div>))}
        </div>
      </div>

      <div className="glass p-5 mt-4">
        <div className="flex justify-between flex-wrap gap-2 mb-3"><h3 className="font-bold">Needs restocking</h3><span className="text-mist text-sm">Stock worth {money(products.reduce((a, p) => a + p.stock * p.cost, 0))}</span></div>
        {low.length === 0 && <p className="text-mist">Every product is above its reorder level.</p>}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {low.map((p, i) => (
            <motion.div key={p.id} className="flex justify-between rounded-xl bg-coral/10 px-4 py-3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.08 }}>
              <span className="truncate">{p.name}</span><span className="text-coral font-bold">{p.stock} left</span>
            </motion.div>))}
        </div>
      </div>
    </Page>
  )
}
