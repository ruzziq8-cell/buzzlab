-- Update function get_due_reminders to include all active tasks regardless of reminder_interval
-- This allows the 5-minute and 1-minute fixed reminders to work even if custom interval is 0.

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
    COALESCE(t.reminder_interval, 0), -- Return 0 if null
    t.last_reminded_at,
    t.created_at
  FROM public.tasks t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE 
    t.status = 'active' 
    -- Removed "AND t.reminder_interval > 0" to allow fixed reminders (5m, 1m) for all tasks
    AND p.whatsapp_number IS NOT NULL
    AND p.is_reminder_enabled = true;
END;
$$ LANGUAGE plpgsql;
