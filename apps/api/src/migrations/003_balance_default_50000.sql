-- New rows default to 50,000 TZS starting balance (matches API createUser).
-- Run in Supabase SQL Editor if the table already exists with balance default 0.

alter table users alter column balance set default 50000;
