-- Daily overtime and double time, per job. Some jurisdictions pay overtime
-- for long days as well as long weeks: California and British Columbia pay
-- 1.5x after 8 hours in a day and 2x after 12; Alaska and Nevada 1.5x after
-- 8; Colorado 1.5x after 12. Weekly overtime (`overtime_threshold_minutes`)
-- still applies on top, counting only hours that weren't already daily
-- overtime. All null = weekly-only, exactly as before.

alter table public.jobs
  add column daily_overtime_threshold_minutes integer
    check (daily_overtime_threshold_minutes is null or daily_overtime_threshold_minutes between 1 and 1440),
  add column double_time_threshold_minutes integer
    check (double_time_threshold_minutes is null or double_time_threshold_minutes between 1 and 1440),
  add column double_time_rate numeric(10, 2)
    check (double_time_rate is null or double_time_rate >= 0),
  add constraint jobs_double_time_after_daily_check check (
    double_time_threshold_minutes is null
    or daily_overtime_threshold_minutes is null
    or double_time_threshold_minutes > daily_overtime_threshold_minutes
  );

comment on column public.jobs.daily_overtime_threshold_minutes is
  'Paid minutes in one workday (the local date a shift starts) before daily overtime applies; null = no daily overtime.';
comment on column public.jobs.double_time_threshold_minutes is
  'Paid minutes in one workday before double time applies; null = no double time.';
comment on column public.jobs.double_time_rate is
  'Hourly double-time rate; null = twice the hourly rate.';
