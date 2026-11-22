import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Btn, Modal, money, notify, useQuery } from '../../lib/ui'
import type { Line, Order } from '../../lib/types'

export default function OrderDetail({ order, open, onClose }: { order: Order | null; open: boolean; onClose: () => void }) {
  const lines = useQuery<Line[]>(() => order
    ? supabase.from('order_items').select('*, products(name)').eq('order_id', order.id)
    : Promise.resolve({ data: [] as Line[], error: null }), [order?.id])
  const due = order ? order.total - order.paid : 0
  const [amt, setAmt] = useState(0)
  useEffect(() => setAmt(due), [due, order?.id])
  if (!order) return null
  const sale = order.type === 'sale'

  const pay = async () => {
    const { error } = await supabase.rpc('settle_order', { p_order: order.id, p_amount: amt })
    if (error) return notify(error.message, false)
    notify(sale ? 'Payment received. Cash and receivable updated.' : 'Supplier paid. Cash and payable updated.')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={order.no}>
      <div className="printable">
        <p className="text-mist mb-3">{order.parties?.name ?? 'Walk-in'} · {new Date(order.created_at).toLocaleString()}</p>
        {(lines.data ?? []).map(l => (
          <div key={l.id} className="flex justify-between gap-3 py-2 border-b border-white/5"><span>{l.products?.name} × {l.qty}</span><span>{money(l.qty * l.unit_price)}</span></div>))}
        <div className="flex justify-between text-lg font-bold mt-3"><span>Total</span><span>{money(order.total)}</span></div>
        <div className="flex justify-between text-mint"><span>Paid</span><span>{money(order.paid)}</span></div>
        <div className="flex justify-between text-coral"><span>Due</span><span>{money(due)}</span></div>
      </div>
      <div className="noprint flex flex-wrap gap-2 mt-5 items-center">
        {due > 0 && <>
          <input className="inp w-36" type="number" min={1} max={due} value={amt} onChange={e => setAmt(+e.target.value)} aria-label="Amount" />
          <Btn onClick={pay}>{sale ? 'Receive payment' : 'Pay supplier'}</Btn></>}
        <Btn ghost onClick={() => window.print()}><Printer size={16} />Print</Btn>
      </div>
    </Modal>
  )
}
