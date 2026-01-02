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

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Fungsi Helper untuk Bot (Bypass RLS) --

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
SECURITY DEFINER -- Penting: Bypass RLS agar bot bisa baca semua data
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

-- 2. Update waktu reminder terakhir (Bypass RLS)
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
