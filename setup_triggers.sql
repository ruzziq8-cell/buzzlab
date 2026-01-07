-- 1. Trigger untuk membuat profile otomatis saat user baru mendaftar
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, is_reminder_enabled)
  VALUES (new.id, 'user', true);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Pasang Trigger ke tabel auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Fix untuk user yang SUDAH ADA tapi belum punya profile
INSERT INTO public.profiles (id, role, is_reminder_enabled)
SELECT id, 'user', true
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
