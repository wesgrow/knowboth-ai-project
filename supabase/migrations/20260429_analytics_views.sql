create or replace view vw_categories_3m as
select
  e.user_id,
  ei.category,
  sum(ei.price * ei.quantity) as total,
  count(distinct e.id) as expense_count
from expense_items ei
join expenses e on e.id = ei.expense_id
where e.purchase_date >= current_date - interval '3 months'
group by e.user_id, ei.category;

create or replace view vw_stores_3m as
select
  e.user_id,
  e.store_name,
  e.brand_id,
  count(*) as visits,
  sum(e.total) as total_spent,
  avg(e.total) as avg_per_visit
from expenses e
where e.purchase_date >= current_date - interval '3 months'
group by e.user_id, e.store_name, e.brand_id;

create or replace view vw_weekday_spend as
select
  e.user_id,
  to_char(e.purchase_date, 'Dy') as day_name,
  extract(dow from e.purchase_date)::int as day_num,
  sum(e.total) as total_spent,
  count(*) as visits
from expenses e
group by e.user_id, day_name, day_num;
