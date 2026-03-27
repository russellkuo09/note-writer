-- Run this in the Supabase SQL editor to make a user an admin.
-- Replace the email below with Russell's email.

update profiles
set role = 'admin'
where email = 'russell@example.com'; -- ← replace with actual email
