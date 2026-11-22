import { useState } from 'react'
import { motion } from 'framer-motion'
import { Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Btn, Modal, Page, Row, Stat, Table, money, notify, useQuery } from '../../lib/ui'
import type { Balance, Ledger } from '../../lib/types'

export default function Accounts() {
  const bal = useQuery<Balance[]>(() => supabase.from('account_balances').select('*').order('code'))
  const led = useQuery<Ledger[]>(() => supabase.from('ledger').select('*, accounts(name)').order('created_at', { ascending: false }).limit(12))
  const [open, setOpen] = useState(false)
  const [amt, setAmt] = useState(0)
  const [memo, setMemo] = useState('')

  const b = bal.data ?? []
  const natural = (x: Balance) => (x.type === 'asset' || x.type === 'expense' ? x.debit - x.credit : x.credit - x.debit)
  const sumT = (t: string) => b.filter(x => x.type === t).reduce((a, x) => a + natural(x), 0)
  const income = sumT('income'), expense = sumT('expense')
  const balanced = Math.abs(b.reduce((a, x) => a + x.debit - x.credit, 0)) < 0.01

  const addExpense = async () => {
    if (amt <= 0) return notify('Amount must be positive', false)
    const { error } = await supabase.rpc('add_expense', { p_amount: amt, p_memo: memo || 'Expense' })
    if (error) return notify(error.message, false)
    notify('Expense recorded. Cash and profit updated.')
    setOpen(false); setAmt(0); setMemo('')
  }

  return (
    <Page title="Accounts" sub="Double-entry ledger, posted automatically by every transaction"
      action={<>
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={'px-3 py-2 rounded-xl text-sm font-bold ' + (balanced ? 'bg-mint/15 text-mint' : 'bg-coral/15 text-coral')}>{balanced ? 'Books balanced' : 'Out of balance'}</motion.span>
        <Btn onClick={() => setOpen(true)}><Receipt size={16} />Add expense</Btn>
      </>}>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Stat i={0} label="Income" v={income} glow="bg-mint" />
        <Stat i={1} label="Expenses" v={expense} glow="bg-coral" />
        <Stat i={2} label="Net profit" v={income - expense} glow="bg-brass" />
        <Stat i={3} label="Cash" v={b.filter(x => x.code === '1000').reduce((a, x) => a + natural(x), 0)} glow="bg-sky-400" />
      </div>
      <Table head={['Code', 'Account', 'Type', 'Debit', 'Credit', 'Balance']}>
        {b.map((x, i) => (
          <Row key={x.id} i={i}>
            <td className="text-mist">{x.code}</td><td>{x.name}</td><td className="capitalize text-mist">{x.type}</td>
            <td>{money(x.debit)}</td><td>{money(x.credit)}</td><td className="font-bold text-brass">{money(natural(x))}</td>
          </Row>))}
      </Table>
      <h3 className="font-bold mt-8 mb-3">Latest postings</h3>
      <div className="grid gap-2 md:grid-cols-2">
        {(led.data ?? []).map((l, i) => (
          <motion.div key={l.id} className="glass px-4 py-3 flex gap-3" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
            <span className="flex-1 min-w-0">{l.accounts?.name} <span className="text-mist text-sm block truncate">{l.memo}</span></span>
            {l.debit > 0 ? <span className="text-mint">Dr {money(l.debit)}</span> : <span className="text-coral">Cr {money(l.credit)}</span>}
          </motion.div>))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add expense">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-mist">Amount<input className="inp mt-1" type="number" min={1} value={amt} onChange={e => setAmt(+e.target.value)} /></label>
          <label className="text-sm text-mist">What was it for?<input className="inp mt-1" placeholder="Rent, salary, transport" value={memo} onChange={e => setMemo(e.target.value)} /></label>
        </div>
        <Btn className="mt-5 w-full sm:w-auto" onClick={addExpense}>Record expense</Btn>
      </Modal>
    </Page>
  )
}
