-- Flow ERP schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create sequence if not exists order_seq;

create table parties (
  id uuid primary key default gen_random_uuid(),
  name text not null, type text not null check (type in ('customer','supplier')),
  phone text, created_at timestamptz default now());
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null, name text not null,
  cost numeric(12,2) not null default 0, price numeric(12,2) not null default 0,
  stock int not null default 0 check (stock >= 0), reorder_level int not null default 5,
  created_at timestamptz default now());
create table orders (
  id uuid primary key default gen_random_uuid(),
  no text unique not null, type text not null check (type in ('sale','purchase')),
  party_id uuid references parties(id), total numeric(12,2) not null,
  paid numeric(12,2) not null default 0, created_at timestamptz default now());
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty int not null check (qty > 0), unit_price numeric(12,2) not null);
create table stock_moves (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id), order_id uuid references orders(id),
  qty int not null, kind text not null check (kind in ('in','out')), created_at timestamptz default now());
create table accounts (
  id serial primary key, code text unique not null, name text not null,
  type text not null check (type in ('asset','liability','income','expense')));
create table ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id), account_id int not null references accounts(id),
  debit numeric(12,2) not null default 0, credit numeric(12,2) not null default 0,
  memo text, created_at timestamptz default now());
create index on order_items(order_id);
create index on stock_moves(product_id);
create index on ledger(account_id);

create view account_balances as
  select a.id, a.code, a.name, a.type,
         coalesce(sum(l.debit),0)::float8 as debit, coalesce(sum(l.credit),0)::float8 as credit
  from accounts a left join ledger l on l.account_id = a.id group by a.id;

create function acc(c text) returns int language sql stable as $$ select id from accounts where code = c $$;

-- One atomic transaction: order + items + stock + stock moves + double-entry ledger.
create function place_order(p_type text, p_party uuid, p_items jsonb, p_paid numeric default 0)
returns uuid language plpgsql as $$
declare
  o_id uuid; it jsonb; pid uuid; q int; pr numeric; c numeric; s int;
  total numeric := 0; cogs numeric := 0; paid numeric;
begin
  if p_type not in ('sale','purchase') then raise exception 'Invalid order type'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Add at least one item'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    total := total + (it->>'qty')::int * (it->>'unit_price')::numeric;
  end loop;
  paid := least(greatest(coalesce(p_paid, 0), 0), total);
  insert into orders(no, type, party_id, total, paid)
  values ((case when p_type = 'sale' then 'SO-' else 'PO-' end) || lpad(nextval('order_seq')::text, 5, '0'), p_type, p_party, total, paid)
  returning id into o_id;

  for it in select * from jsonb_array_elements(p_items) loop
    pid := (it->>'product_id')::uuid; q := (it->>'qty')::int; pr := (it->>'unit_price')::numeric;
    insert into order_items(order_id, product_id, qty, unit_price) values (o_id, pid, q, pr);
    if p_type = 'purchase' then
      update products set stock = stock + q, cost = pr where id = pid;
      insert into stock_moves(product_id, order_id, qty, kind) values (pid, o_id, q, 'in');
    else
      select cost, stock into c, s from products where id = pid for update;
      if s < q then raise exception 'Insufficient stock: only % available', s; end if;
      update products set stock = stock - q where id = pid;
      insert into stock_moves(product_id, order_id, qty, kind) values (pid, o_id, q, 'out');
      cogs := cogs + q * c;
    end if;
  end loop;

  if p_type = 'purchase' then
    insert into ledger(order_id, account_id, debit, credit, memo)
    select o_id, a, d, k, m from (values
      (acc('1200'), total, 0, 'Inventory purchased'),
      (acc('1000'), 0, paid, 'Cash paid to supplier'),
      (acc('2000'), 0, total - paid, 'Payable to supplier')) v(a, d, k, m) where d + k > 0;
  else
    insert into ledger(order_id, account_id, debit, credit, memo)
    select o_id, a, d, k, m from (values
      (acc('1000'), paid, 0, 'Cash received'),
      (acc('1100'), total - paid, 0, 'Customer receivable'),
      (acc('4000'), 0, total, 'Sales revenue'),
      (acc('5000'), cogs, 0, 'Cost of goods sold'),
      (acc('1200'), 0, cogs, 'Inventory out')) v(a, d, k, m) where d + k > 0;
  end if;
  return o_id;
end $$;

-- Demo-open RLS (replace with auth-based policies in production)
do $$ declare t text; begin
  for t in select unnest(array['parties','products','orders','order_items','stock_moves','accounts','ledger']) loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "open" on %I for all using (true) with check (true)', t);
  end loop; end $$;

-- Seed data
insert into accounts(code,name,type) values
 ('1000','Cash','asset'),('1100','Accounts Receivable','asset'),('1200','Inventory','asset'),
 ('2000','Accounts Payable','liability'),('4000','Sales Revenue','income'),('5000','Cost of Goods Sold','expense');
insert into parties(name,type,phone) values
 ('Rahim Traders','customer','01700000001'),('Karim Store','customer','01700000002'),
 ('TechSource Ltd','supplier','01800000001'),('Global Imports','supplier','01800000002');
insert into products(sku,name,cost,price,reorder_level) values
 ('KB-01','Keyboard',800,1200,10),('MS-01','Mouse',400,650,10),('MN-01','Monitor 24"',9000,12500,5),('HS-01','Headset',1500,2200,5);
-- Opening stock arrives through a real purchase, so stock + ledger start consistent
select place_order('purchase',(select id from parties where name='TechSource Ltd'),
  (select jsonb_agg(jsonb_build_object('product_id',id,'qty',20,'unit_price',cost)) from products), 100000);
