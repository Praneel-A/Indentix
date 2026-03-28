-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

create table if not exists users (
  id text primary key,
  phone text unique not null,
  name text,
  verified boolean default false,
  face_embedding jsonb,
  face_hash text,
  face_enrolled_at timestamptz,
  gov_id_image text,
  gov_id_uploaded_at timestamptz,
  onboarded boolean default false,
  balance numeric default 50000,
  trust_score integer default 10,
  trust_level text default 'UNVERIFIED',
  is_agent boolean default false,
  revoked boolean default false,
  revoked_at timestamptz,
  transactions jsonb default '[]'::jsonb,
  password_hash text,
  recovery_email text,
  created_at timestamptz default now()
);

-- Demo users
insert into users (id, phone, name, verified, onboarded, balance, trust_score, trust_level, is_agent, transactions, created_at) values
  ('user_praneel', '+14703803242', 'Praneel Anand', true, true, 1250000, 92, 'TRUSTED', false,
   '[{"id":"tx1","from":"+14703803242","to":"+255787654321","amount":50000,"currency":"TZS","status":"confirmed","timestamp":"2026-03-27T10:30:00Z"},{"id":"tx2","from":"+255798888888","to":"+14703803242","amount":25000,"currency":"TZS","status":"confirmed","timestamp":"2026-03-26T14:15:00Z"},{"id":"tx3","from":"+14703803242","to":"+255798888888","amount":150000,"currency":"TZS","status":"confirmed","timestamp":"2026-03-25T09:00:00Z"},{"id":"tx4","from":"+255787654321","to":"+14703803242","amount":75000,"currency":"TZS","status":"confirmed","timestamp":"2026-03-24T16:45:00Z"},{"id":"tx5","from":"+14703803242","to":"+255787654321","amount":30000,"currency":"TZS","status":"pending","timestamp":"2026-03-27T11:00:00Z"}]'::jsonb,
   '2025-01-15T08:00:00Z'),
  ('user_juma', '+255787654321', 'Juma Bakari', true, true, 340000, 75, 'VERIFIED', false, '[]'::jsonb, '2025-06-01T10:00:00Z'),
  ('user_scammer', '+255700000000', 'Unknown Caller', false, false, 0, 5, 'SCAMMER', false,
   '[{"id":"tx6","from":"+255700000000","to":"+14703803242","amount":500000,"currency":"TZS","status":"fake","timestamp":"2026-03-27T09:00:00Z"}]'::jsonb,
   '2026-03-20T12:00:00Z'),
  ('user_fake_agent', '+255711111111', 'M-Pesa Agent (FAKE)', false, false, 50000, 12, 'UNVERIFIED', true, '[]'::jsonb, '2026-03-25T08:00:00Z'),
  ('user_real_agent', '+255798888888', 'M-Pesa Agent Kariakoo', true, true, 5600000, 88, 'TRUSTED', true, '[]'::jsonb, '2024-11-01T08:00:00Z')
on conflict (id) do nothing;
