-- Run once if you already created `users` before password support was added.

alter table users add column if not exists password_hash text;
