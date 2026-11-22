-- Flow ERP upgrade: expenses, payments, stock adjustments, analytics views, realtime.
insert into accounts(code,name,type) values ('6000','Operating Expenses','expense') on conflict (code) do nothing;

create or replace view party_balances as
  select p.id, p.name, p.type, p.phone,
         coalesce(sum(o.total),0)::float8 as billed, coalesce(sum(o.paid),0)::float8 as paid,
         coalesce(sum(o.total - o.paid),0)::float8 as due, count(o.id)::int as orders
  from parties p left join orders o on o.party_id = p.id group by p.id;

create or replace view daily_totals as
  select d::date as day,
         coalesce(sum(o.total) filter (where o.type = 'sale'),0)::float8 as sales,
         coalesce(sum(o.total) filter (where o.type = 'purchase'),0)::float8 as purchases
  from generate_series(current_date - 6, current_date, interval '1 day') d
  left join orders o on o.created_at::date = d::date group by d order by d;

create or replace view top_products as
  select p.id, p.name, sum(i.qty)::int as qty, sum(i.qty * i.unit_price)::float8 as revenue
  from order_items i join orders o on o.id = i.order_id and o.type = 'sale'
  join products p on p.id = i.product_id group by p.id order by qty desc limit 5;

-- Collect a customer due (Dr Cash / Cr Receivable) or pay a supplier (Dr Payable / Cr Cash)
create or replace function settle_order(p_order uuid, p_amount numeric) returns void language plpgsql as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if p_amount <= 0 or p_amount > o.total - o.paid then raise exception 'Amount must be between 1 and the due (%)', o.total - o.paid; end if;
  update orders set paid = paid + p_amount where id = p_order;
  if o.type = 'sale' then
    insert into ledger(order_id, account_id, debit, credit, memo) values
      (p_order, acc('1000'), p_amount, 0, 'Payment received'), (p_order, acc('1100'), 0, p_amount, 'Receivable settled');
  else
    insert into ledger(order_id, account_id, debit, credit, memo) values
      (p_order, acc('2000'), p_amount, 0, 'Payable settled'), (p_order, acc('1000'), 0, p_amount, 'Payment made');
  end if;
end $$;

create or replace function add_expense(p_amount numeric, p_memo text) returns void language plpgsql as $$
begin
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  insert into ledger(account_id, debit, credit, memo) values
    (acc('6000'), p_amount, 0, p_memo), (acc('1000'), 0, p_amount, 'Paid: ' || p_memo);
end $$;

-- Damage / loss (negative) or found stock (positive), valued at cost and posted to the ledger
create or replace function adjust_stock(p_product uuid, p_delta int, p_reason text) returns void language plpgsql as $$
declare c numeric; s int; v numeric;
begin
  if p_delta = 0 then raise exception 'Quantity cannot be zero'; end if;
  select cost, stock into c, s from products where id = p_product for update;
  if s + p_delta < 0 then raise exception 'Only % in stock', s; end if;
  update products set stock = stock + p_delta where id = p_product;
  insert into stock_moves(product_id, qty, kind) values (p_product, abs(p_delta), case when p_delta > 0 then 'in' else 'out' end);
  v := abs(p_delta) * c;
  if p_delta < 0 then
    insert into ledger(account_id, debit, credit, memo) values (acc('6000'), v, 0, 'Stock write-off: ' || p_reason), (acc('1200'), 0, v, 'Inventory written off');
  else
    insert into ledger(account_id, debit, credit, memo) values (acc('1200'), v, 0, 'Stock found: ' || p_reason), (acc('6000'), 0, v, 'Stock gain');
  end if;
end $$;

-- Realtime: every open device updates instantly
do $$ declare t text; begin
  for t in select unnest(array['orders','products','ledger','stock_moves','parties']) loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when others then null; end;
  end loop; end $$;
