-- Fix: profiles table + trigger to save all registration data.

-- 1. Add first_name and last_name columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

-- 2. Update handle_new_user trigger to save all metadata from registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, first_name, last_name, doc_type, doc_number, birth_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'doc_type',
    NEW.raw_user_meta_data->>'doc_number',
    CASE
      WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL
        AND NEW.raw_user_meta_data->>'birth_date' <> ''
      THEN (NEW.raw_user_meta_data->>'birth_date')::date
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill existing users: populate first_name/last_name from full_name where missing
UPDATE profiles
SET
  first_name = CASE
    WHEN first_name = '' AND full_name <> '' THEN split_part(full_name, ' ', 1)
    ELSE first_name
  END,
  last_name = CASE
    WHEN last_name = '' AND full_name <> '' THEN trim(both ' ' from replace(full_name, split_part(full_name, ' ', 1), ''))
    ELSE last_name
  END
WHERE first_name = '' OR last_name = '';
