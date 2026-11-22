import { useState } from 'react'
import { motion } from 'framer-motion'
import { UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Btn, Modal, Page, Search, money, notify, useQuery } from '../../lib/ui'
import type { PartyBal } from '../../lib/types'

export default function Parties() {
  const all = useQuery<PartyBal[]>(() => supabase.from('party_balances').select('*').order('name'))
  const [type, setType] = useState<'customer' | 'supplier'>('customer')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', phone: '' })
  const list = (all.data ?? []).filter(p => p.type === type && p.name.toLowerCase().includes(q.toLowerCase()))

  const save = async () => {
    if (!f.name.trim()) return notify('Enter a name', false)
    const { error } = await supabase.from('parties').insert({ name: f.name.trim(), phone: f.phone || null, type })
    if (error) return notify(error.message, false)
    notify(type === 'customer' ? 'Customer added' : 'Supplier added')
    setOpen(false); setF({ name: '', phone: '' }); all.reload()
  }

  return (
    <Page title="Parties" sub="Customers and suppliers with live outstanding balances"
      action={<Btn onClick={() => setOpen(true)}><UserPlus size={16} />Add {type}</Btn>}>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="glass p-1 inline-flex">
          {(['customer', 'supplier'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} className={'relative px-5 py-2 rounded-xl font-semibold capitalize ' + (type === t ? 'text-ink' : 'text-mist')}>
              {type === t && <motion.div layoutId="seg" className="absolute inset-0 rounded-xl bg-brass" transition={{ type: 'spring', stiffness: 420, damping: 30 }} />}
              <span className="relative">{t}s</span>
            </button>))}
        </div>
        <Search v={q} set={setQ} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p, i) => (
          <motion.div key={p.id} className="glass p-5" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.05 }} whileHover={{ y: -4 }}>
            <div className="flex items-center gap-3">
              <div className="size-11 shrink-0 rounded-full bg-brass text-ink grid place-items-center font-extrabold">{p.name[0]}</div>
              <div className="min-w-0"><p className="font-bold truncate">{p.name}</p><p className="text-mist text-sm truncate">{p.phone ?? 'No phone'} · {p.orders} orders</p></div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full bg-mint rounded-full" initial={{ width: 0 }} animate={{ width: (p.billed ? (p.paid / p.billed) * 100 : 0) + '%' }} transition={{ duration: 0.9, delay: 0.2 }} />
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-mist">Billed {money(p.billed)}</span>
              <span className={'font-bold ' + (p.due > 0 ? 'text-coral' : 'text-mint')}>{p.due > 0 ? 'Due ' + money(p.due) : 'Settled'}</span>
            </div>
          </motion.div>))}
      </div>
      {list.length === 0 && <p className="text-mist mt-6 text-center">No {type}s found. Add one to start trading.</p>}

      <Modal open={open} onClose={() => setOpen(false)} title={'New ' + type}>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-mist">Name<input className="inp mt-1" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
          <label className="text-sm text-mist">Phone<input className="inp mt-1" inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
        </div>
        <Btn className="mt-5 w-full sm:w-auto" onClick={save}>Save {type}</Btn>
      </Modal>
    </Page>
  )
}
