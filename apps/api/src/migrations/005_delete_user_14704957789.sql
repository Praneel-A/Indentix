-- Remove account for +1 470 495 7789 (E.164). Safe to run once; no-op if row missing.
delete from users where phone = '+14704957789';
