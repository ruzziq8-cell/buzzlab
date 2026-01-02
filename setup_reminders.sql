-- SQL Script untuk Mengaktifkan Fitur Reminder WhatsApp
-- Silakan jalankan script ini di Supabase SQL Editor

-- 1. Membuat tabel profiles untuk menyimpan nomor WhatsApp user
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  whatsapp_number TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Mengaktifkan RLS (Row Level Security) agar aman
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policy: User bisa melihat profilnya sendiri
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 4. Policy: User bisa mengupdate profilnya sendiri
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 5. Policy: User bisa insert profilnya sendiri
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Menambahkan kolom untuk reminder di tabel tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS reminder_interval INTEGER DEFAULT 0, -- dalam menit (15, 30, 60)
ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP WITH TIME ZONE;

-- 7. Menautkan user ruzziq@gmail.com dengan nomor WhatsApp
-- Catatan: Kita perlu ID user dari auth.users. 
-- Script ini mencoba mencari user berdasarkan email dan memasukkannya ke profiles.
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'ruzziq@gmail.com' LIMIT 1;
  
  IF target_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, whatsapp_number)
    VALUES (target_user_id, '6281295591746')
    ON CONFLICT (id) DO UPDATE
    SET whatsapp_number = '6281295591746';
  END IF;
END $$;
