-- Tabel profiles untuk menyimpan nomor WhatsApp
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  whatsapp_number TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tambahkan kolom reminder ke tabel tasks jika belum ada
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS reminder_interval INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP WITH TIME ZONE;

-- Setup RLS untuk profiles (User hanya bisa update profilenya sendiri)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Fungsi Helper untuk Bot (Bypass RLS) --

-- Hapus fungsi lama agar bersih
DROP FUNCTION IF EXISTS get_due_reminders();
DROP FUNCTION IF EXISTS update_last_reminded(UUID, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS create_task_from_bot(TEXT, TEXT, TEXT, INTEGER);

-- 1. Mengambil semua reminder yang aktif beserta nomor WA pemiliknya
CREATE OR REPLACE FUNCTION get_due_reminders()
RETURNS TABLE (
  id UUID,
  title TEXT,
  priority TEXT,
  due_date TEXT,
  whatsapp_number TEXT,
  reminder_interval INTEGER,
  last_reminded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title::TEXT,
    t.priority::TEXT,
    t.due_date::TEXT,
    p.whatsapp_number::TEXT,
    t.reminder_interval,
    t.last_reminded_at,
    t.created_at
  FROM public.tasks t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE 
    t.status = 'active' 
    AND t.reminder_interval > 0
    AND p.whatsapp_number IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Update waktu reminder terakhir
CREATE OR REPLACE FUNCTION update_last_reminded(task_id UUID, new_time TIMESTAMP WITH TIME ZONE)
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tasks
  SET last_reminded_at = new_time
  WHERE id = task_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Membuat task baru dari Bot
CREATE OR REPLACE FUNCTION create_task_from_bot(
  p_whatsapp_number TEXT,
  p_title TEXT,
  p_due_date TEXT DEFAULT NULL,
  p_interval INTEGER DEFAULT 0
)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_task_id UUID;
  v_final_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Cari user_id berdasarkan nomor WA
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE whatsapp_number = p_whatsapp_number
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'User not found');
  END IF;

  -- Konversi tanggal (jika ada)
  IF p_due_date IS NOT NULL AND p_due_date <> '' THEN
     BEGIN
       v_final_due_date := p_due_date::TIMESTAMP WITH TIME ZONE;
     EXCEPTION WHEN OTHERS THEN
       -- Jika format salah, set NULL atau bisa return error
       v_final_due_date := NULL;
     END;
  ELSE
     v_final_due_date := NULL;
  END IF;

  -- Insert Task
  INSERT INTO public.tasks (user_id, title, status, priority, due_date, reminder_interval, created_at)
  VALUES (v_user_id, p_title, 'active', 'medium', v_final_due_date, p_interval, NOW())
  RETURNING id INTO v_task_id;

  RETURN json_build_object('success', true, 'task_id', v_task_id, 'title', p_title);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql;
