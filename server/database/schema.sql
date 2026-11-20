-- Phone Access App Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('camera', 'microphone', 'sms', 'file', 'note')),
  storage_path TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for files
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);

-- ============================================
-- SMS MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'failed')),
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for SMS
CREATE INDEX IF NOT EXISTS idx_sms_user_id ON sms_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_created_at ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_status ON sms_messages(status);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================
-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE files;
ALTER PUBLICATION supabase_realtime ADD TABLE sms_messages;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Policies for notes
DROP POLICY IF EXISTS "Users can view own notes" ON notes;
CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'anonymous');

DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
CREATE POLICY "Users can insert own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'anonymous');

DROP POLICY IF EXISTS "Users can update own notes" ON notes;
CREATE POLICY "Users can update own notes" ON notes
  FOR UPDATE USING (auth.uid()::text = user_id OR user_id = 'anonymous');

DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (auth.uid()::text = user_id OR user_id = 'anonymous');

-- Policies for files
DROP POLICY IF EXISTS "Users can view own files" ON files;
CREATE POLICY "Users can view own files" ON files
  FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'anonymous');

DROP POLICY IF EXISTS "Users can insert own files" ON files;
CREATE POLICY "Users can insert own files" ON files
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'anonymous');

DROP POLICY IF EXISTS "Users can delete own files" ON files;
CREATE POLICY "Users can delete own files" ON files
  FOR DELETE USING (auth.uid()::text = user_id OR user_id = 'anonymous');

-- Policies for SMS
DROP POLICY IF EXISTS "Users can view own SMS" ON sms_messages;
CREATE POLICY "Users can view own SMS" ON sms_messages
  FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'anonymous');

DROP POLICY IF EXISTS "Users can insert own SMS" ON sms_messages;
CREATE POLICY "Users can insert own SMS" ON sms_messages
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'anonymous');

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  104857600, -- 100MB
  ARRAY['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
CREATE POLICY "Users can upload files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'uploads' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR (storage.foldername(name))[1] = 'anonymous')
  );

DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'uploads' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR (storage.foldername(name))[1] = 'anonymous')
  );

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'uploads' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR (storage.foldername(name))[1] = 'anonymous')
  );

-- Public read access for all uploads
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');

-- ============================================
-- FUNCTIONS
-- ============================================
-- Function to get file count by type
CREATE OR REPLACE FUNCTION get_file_stats(p_user_id TEXT)
RETURNS TABLE (
  type TEXT,
  count BIGINT,
  total_size BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.type,
    COUNT(*) as count,
    COALESCE(SUM(f.size), 0) as total_size
  FROM files f
  WHERE f.user_id = p_user_id OR f.user_id = 'anonymous'
  GROUP BY f.type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent activity
CREATE OR REPLACE FUNCTION get_recent_activity(p_user_id TEXT, p_limit INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  (
    SELECT n.id, 'note'::TEXT as type, n.title, n.created_at
    FROM notes n
    WHERE n.user_id = p_user_id OR n.user_id = 'anonymous'
  )
  UNION ALL
  (
    SELECT f.id, 'file'::TEXT as type, f.filename as title, f.created_at
    FROM files f
    WHERE f.user_id = p_user_id OR f.user_id = 'anonymous'
  )
  UNION ALL
  (
    SELECT s.id, 'sms'::TEXT as type,
      COALESCE(s.phone_number, '') || ': ' || LEFT(s.message, 50) as title,
      s.created_at
    FROM sms_messages s
    WHERE s.user_id = p_user_id OR s.user_id = 'anonymous'
  )
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEWS
-- ============================================
-- View for dashboard stats
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM notes) as total_notes,
  (SELECT COUNT(*) FROM files) as total_files,
  (SELECT COUNT(*) FROM sms_messages) as total_sms,
  (SELECT COALESCE(SUM(size), 0) FROM files) as total_storage_bytes,
  (SELECT MAX(created_at) FROM notes) as last_note_at,
  (SELECT MAX(created_at) FROM files) as last_file_at,
  (SELECT MAX(created_at) FROM sms_messages) as last_sms_at;

-- ============================================
-- GRANTS
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;