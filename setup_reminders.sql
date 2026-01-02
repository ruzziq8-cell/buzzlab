-- Tabel profiles untuk menyimpan nomor WhatsApp
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  whatsapp_number TEXT,
  role TEXT DEFAULT 'user',
  is_reminder_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tambahkan kolom jika tabel sudah ada (idempotency)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE public.profiles ADD COLUMN is_reminder_enabled BOOLEAN DEFAULT true;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;


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
    AND p.whatsapp_number IS NOT NULL
    AND p.is_reminder_enabled = true;
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

-- 4. Admin RPC: Get All Users Stats
CREATE OR REPLACE FUNCTION get_admin_users_stats()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  whatsapp_number TEXT,
  role TEXT,
  is_reminder_enabled BOOLEAN,
  total_tasks BIGINT,
  active_tasks BIGINT
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    u.email::TEXT,
    p.whatsapp_number::TEXT,
    p.role::TEXT,
    p.is_reminder_enabled,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'active' THEN 1 END) as active_tasks
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  LEFT JOIN public.tasks t ON p.id = t.user_id
  GROUP BY p.id, u.email, p.whatsapp_number, p.role, p.is_reminder_enabled;
END;
$$ LANGUAGE plpgsql;

-- 5. Admin RPC: Toggle Reminder Status
CREATE OR REPLACE FUNCTION toggle_user_reminder_status(target_user_id UUID, new_status BOOLEAN)
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET is_reminder_enabled = new_status
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;

