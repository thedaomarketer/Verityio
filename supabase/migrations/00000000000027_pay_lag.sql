-- Many employers pay a few days after a pay period closes (e.g. a period
-- ending Saturday, paid the following Thursday). pay_lag_days is the number
-- of days from a period's last day to its payday; null keeps the original
-- assumption that a period ends the day before payday (a lag of 1).

alter table public.jobs
  add column pay_lag_days smallint check (pay_lag_days is null or pay_lag_days between 0 and 31);
