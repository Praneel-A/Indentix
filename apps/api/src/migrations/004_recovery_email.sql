-- Optional recovery email for account notices / future recovery flows.
alter table users add column if not exists recovery_email text;
