import { useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Btn, Modal, Num, Page, Row, Search, Table, csv, money, notify, useQuery } from '../../lib/ui'
import OrderDetail from './OrderDetail'
import type { ItemRow, Order, Party, Product } from '../../lib/types'

const blank: ItemRow = { product_id: '', qty: 1, unit_price: 0 }
const status = (o: Order) => (o.total - o.paid <= 0 ? ['Paid', 'text-mint bg-mint/15'] : o.paid > 0 ? ['Partial', 'text-brass bg-brass/15'] : ['Unpaid', 'text-coral bg-coral/15'])

export default function OrderModule({ type }: { type: 'sale' | 'purchase' }) {
  const sale = type === 'sale'
  const orders = useQuery<Order[]>(() => supabase.from('orders').select('*, parties(name)').eq('type', type).order('created_at', { ascending: false }), [type])
  const parties = useQuery<Party[]>(() => supabase.from('parties').select('*').eq('type', sale ? 'customer' : 'supplier'), [type])
  const products = useQuery<Product[]>(() => supabase.from('products').select('*').order('name'))
  const [open, setOpen] = useState(false)
  const [party, setParty] = useState('')
  const [paid, setPaid] = useState(0)
  const [items, setItems] = useState<ItemRow[]>([blank])
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [showSel, setShowSel] = useState(false)
  const sel = (orders.data ?? []).find(o => o.id === selId) ?? null

  const shown = (orders.data ?? []).filter(o => (o.no + (o.parties?.name ?? 'walk-in')).toLowerCase().includes(q.toLowerCase()))
  const total = items.reduce((a, i) => a + i.qty * i.unit_price, 0)
  const prod = (id: string) => products.data?.find(p => p.id === id)
  const pick = (id: string): ItemRow => ({ product_id: id, qty: 1, unit_price: sale ? prod(id)?.price ?? 0 : prod(id)?.cost ?? 0 })
  const patch = (i: number, v: Partial<ItemRow>) => setItems(items.map((r, j) => (j === i ? { ...r, ...v } : r)))

  const submit = async () => {
    if (items.some(i => !i.product_id)) return notify('Choose a product for every line', false)
    if (items.some(i => i.qty <= 0 || i.unit_price < 0)) return notify('Quantity must be positive and price cannot be negative', false)
    if (paid < 0 || paid > total) return notify('Paid amount must be between 0 and total', false)
    setBusy(true)
    const { error } = await supabase.rpc('place_order', { p_type: type, p_party: party || null, p_items: items, p_paid: paid })
    setBusy(false)
    if (error) return notify(error.message, false)
    notify(sale ? 'Sale saved. Stock reduced, ledger updated.' : 'Purchase saved. Stock increased, ledger updated.')
    setOpen(false); setItems([blank]); setPaid(0); setParty('')
    orders.reload(); products.reload()
  }

  return (
    <Page title={sale ? 'Sales' : 'Purchases'} sub={sale ? 'Every sale reduces stock and posts revenue' : 'Every purchase adds stock and posts inventory'}
      action={<Btn onClick={() => setOpen(true)}><Plus size={16} />New {sale ? 'sale' : 'purchase'}</Btn>}>
      <div className="flex gap-2 mb-4">
        <Search v={q} set={setQ} />
        <Btn ghost onClick={() => csv(type + 's', shown.map(o => ({ no: o.no, date: o.created_at.slice(0, 10), party: o.parties?.name ?? '', total: o.total, paid: o.paid })))}><Download size={16} />CSV</Btn>
      </div>
      <Table head={['No', 'Date', sale ? 'Customer' : 'Supplier', 'Total', 'Due', 'Status']}>
        {shown.map((o, i) => {
          const [label, cls] = status(o)
          return (
            <Row key={o.id} i={i} onClick={() => { setSelId(o.id); setShowSel(true) }}>
              <td className="font-bold text-brass">{o.no}</td><td>{new Date(o.created_at).toLocaleDateString()}</td>
              <td>{o.parties?.name ?? 'Walk-in'}</td><td>{money(o.total)}</td><td>{money(o.total - o.paid)}</td>
              <td><span className={'px-2 py-0.5 rounded-full text-xs font-bold ' + cls}>{label}</span></td>
            </Row>)
        })}
      </Table>
      {shown.length === 0 && <p className="text-mist mt-6 text-center">Nothing here yet. Create the first {sale ? 'sale' : 'purchase'}.</p>}
      <OrderDetail order={sel} open={showSel} onClose={() => setShowSel(false)} />

      <Modal open={open} onClose={() => setOpen(false)} title={'New ' + (sale ? 'sale' : 'purchase')}>
        <select className="inp mb-4" value={party} onChange={e => setParty(e.target.value)}>
          <option value="">{sale ? 'Walk-in customer' : 'No supplier'}</option>
          {parties.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3 items-center p-3 sm:p-0 rounded-xl bg-white/[0.03] sm:bg-transparent">
            <select className="inp sm:col-span-6" value={it.product_id} onChange={e => patch(i, pick(e.target.value))}>
              <option value="">Product</option>
              {products.data?.map(p => <option key={p.id} value={p.id}>{p.name} (stock {p.stock})</option>)}
            </select>
            <div className="grid grid-cols-[1fr_1fr_auto] sm:contents gap-2">
              <input className={'inp sm:col-span-2 ' + (sale && it.qty > (prod(it.product_id)?.stock ?? Infinity) ? 'border-coral' : '')} type="number" min={1} value={it.qty} onChange={e => patch(i, { qty: +e.target.value })} aria-label="Quantity" />
              <input className="inp sm:col-span-3" type="number" min={0} value={it.unit_price} onChange={e => patch(i, { unit_price: +e.target.value })} aria-label="Unit price" />
              <button className="sm:col-span-1 justify-self-center p-2" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : items)} aria-label="Remove line"><Trash2 size={18} className="text-coral" /></button>
            </div>
          </div>))}
        <button className="text-brass text-sm mt-1" onClick={() => setItems([...items, blank])}>Add line</button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-6 gap-3">
          <label className="text-sm text-mist">Paid now<input className="inp w-32 ml-2 inline-block" type="number" min={0} value={paid} onChange={e => setPaid(+e.target.value)} /></label>
          <div className="text-2xl font-bold"><Num v={total} /></div>
          <Btn className="w-full sm:w-auto" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save ' + (sale ? 'sale' : 'purchase')}</Btn>
        </div>
      </Modal>
    </Page>
  )
}
