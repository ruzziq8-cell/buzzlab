-- 1. Tambahkan kolom completed_at ke tabel tasks jika belum ada
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- 2. Pastikan RLS mengizinkan update kolom ini (biasanya sudah termasuk di ALL/UPDATE)
-- Tidak perlu policy khusus jika policy UPDATE sudah ada dan mencakup semua kolom.
