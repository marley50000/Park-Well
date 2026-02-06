-- Run this in your Supabase SQL Editor to enable owner tracking
ALTER TABLE spots 
ADD COLUMN owner_id text;

-- Optional: Link it to users if you want referential integrity, 
-- but 'text' is safer if you have demo users not in the users table yet.
-- ALTER TABLE spots ADD CONSTRAINT fk_owner FOREIGN KEY (owner_id) REFERENCES users(id);
