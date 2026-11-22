import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, Download, PackagePlus, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Btn, Modal, Page, Row, Search, Stat, Table, csv, money, notify, useQuery } from '../../lib/ui'
import type { Move, Product } from '../../lib/types'

const empty = { sku: '', name: '', cost: 0, price: 0, reorder_level: 5 }

export default function Inventory() {
  const prods = useQuery<Product[]>(() => supabase.from('products').select('*').order('name'))
  const moves = useQuery<Move[]>(() => supabase.from('stock_moves').select('*, products(name)').order('created_at', { ascending: false }).limit(10))
  const [open, setOpen] = useState(false)
  const [f, setF] = useState(empty)
  const [adj, setAdj] = useState<Product | null>(null)
  const [delta, setDelta] = useState(0)
  const [why, setWhy] = useState('Damaged goods')
  const [q, setQ] = useState('')

  const all = prods.data ?? []
  const list = all.filter(p => (p.name + p.sku).toLowerCase().includes(q.toLowerCase()))
  const max = Math.max(1, ...all.map(p => p.stock))

  const save = async () => {
    if (!f.sku.trim() || !f.name.trim()) return notify('SKU and name are required', false)
    if (f.cost < 0 || f.price < 0 || f.reorder_level < 0) return notify('Cost, price, and reorder level cannot be negative', false)
    const { error } = await supabase.from('products').insert(f)
    if (error) return notify(error.message, false)
    notify('Product added. Buy it to add stock.')
    setOpen(false); setF(empty); prods.reload()
  }
  const adjust = async () => {
    if (!adj || !delta) return notify('Enter a quantity other than zero', false)
    const { error } = await supabase.rpc('adjust_stock', { p_product: adj.id, p_delta: delta, p_reason: why })
    if (error) return notify(error.message, false)
    notify('Stock adjusted. Inventory value and ledger updated.')
    setAdj(null); setDelta(0); prods.reload()
  }

  return (
    <Page title="Inventory" sub="Stock moves automatically with every purchase and sale"
      action={<Btn onClick={() => setOpen(true)}><PackagePlus size={16} />Add product</Btn>}>
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-5">
        <Stat i={0} label="Products" v={all.length} money={false} glow="bg-brass" />
        <Stat i={1} label="Stock value" v={all.reduce((a, p) => a + p.stock * p.cost, 0)} glow="bg-mint" />
        <Stat i={2} label="Low stock" v={all.filter(p => p.stock <= p.reorder_level).length} money={false} glow="bg-coral" />
      </div>
      <div className="flex gap-2 mb-4">
        <Search v={q} set={setQ} />
        <Btn ghost onClick={() => csv('inventory', list.map(p => ({ sku: p.sku, name: p.name, cost: p.cost, price: p.price, stock: p.stock })))}><Download size={16} />CSV</Btn>
      </div>
      <Table head={['SKU', 'Product', 'Cost', 'Price', 'Stock', 'Level', '']}>
        {list.map((p, i) => {
          const low = p.stock <= p.reorder_level
          return (
            <Row key={p.id} i={i}>
              <td className="text-mist">{p.sku}</td><td className="font-semibold">{p.name}</td><td>{money(p.cost)}</td><td>{money(p.price)}</td>
              <td className={'font-bold ' + (low ? 'text-coral' : 'text-mint')}>{p.stock}</td>
              <td className="md:w-40"><div className="h-2 w-28 md:w-full rounded-full bg-white/10 overflow-hidden">
                <motion.div className={'h-full rounded-full ' + (low ? 'bg-coral' : 'bg-mint')} initial={{ width: 0 }} animate={{ width: (p.stock / max) * 100 + '%' }} transition={{ duration: 0.9, delay: i * 0.05 }} />
              </div></td>
              <td><Btn ghost onClick={() => setAdj(p)}><SlidersHorizontal size={14} />Adjust</Btn></td>
            </Row>)
        })}
      </Table>
      <h3 className="font-bold mt-8 mb-3">Recent stock movements</h3>
      <div className="grid gap-2 md:grid-cols-2">
        {(moves.data ?? []).map((m, i) => (
          <motion.div key={m.id} className="glass px-4 py-3 flex items-center gap-3" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            {m.kind === 'in' ? <ArrowDownLeft className="text-mint" /> : <ArrowUpRight className="text-coral" />}
            <span className="flex-1 truncate">{m.products?.name}</span>
            <span className={'font-bold ' + (m.kind === 'in' ? 'text-mint' : 'text-coral')}>{m.kind === 'in' ? '+' : '−'}{m.qty}</span>
          </motion.div>))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New product">
        <div className="grid grid-cols-2 gap-3">
          {(['sku', 'name', 'cost', 'price', 'reorder_level'] as const).map(k => (
            <label key={k} className="text-sm text-mist capitalize">{k.replace('_', ' ')}
              <input className="inp mt-1" type={typeof f[k] === 'number' ? 'number' : 'text'} value={f[k]}
                onChange={e => setF({ ...f, [k]: typeof f[k] === 'number' ? +e.target.value : e.target.value })} />
            </label>))}
        </div>
        <Btn className="mt-5 w-full sm:w-auto" onClick={save}>Save product</Btn>
      </Modal>

      <Modal open={!!adj} onClose={() => setAdj(null)} title={'Adjust ' + (adj?.name ?? '')}>
        <p className="text-mist text-sm mb-3">Use a negative number for damaged or lost stock and a positive number for found stock. Inventory value and the ledger update automatically.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-mist">Quantity change<input className="inp mt-1" type="number" value={delta} onChange={e => setDelta(+e.target.value)} /></label>
          <label className="text-sm text-mist">Reason<input className="inp mt-1" value={why} onChange={e => setWhy(e.target.value)} /></label>
        </div>
        <Btn className="mt-5 w-full sm:w-auto" onClick={adjust}>Apply adjustment</Btn>
      </Modal>
    </Page>
  )
}
