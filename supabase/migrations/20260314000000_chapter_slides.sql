-- =============================================================
-- Slide Integration: chapter_slides table + chapters.slide_audio_url
-- =============================================================

BEGIN;

-- 1. Create chapter_slides table
CREATE TABLE chapter_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  image_storage_path TEXT,
  text_content TEXT,
  text_status TEXT DEFAULT 'pending' CHECK (text_status IN ('pending', 'generating', 'review', 'approved')),
  audio_start_ms INTEGER,
  audio_end_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by chapter
CREATE INDEX idx_chapter_slides_chapter_id ON chapter_slides(chapter_id);
CREATE UNIQUE INDEX idx_chapter_slides_order ON chapter_slides(chapter_id, "order");

-- 2. Add slide_audio_url to chapters
ALTER TABLE chapters ADD COLUMN slide_audio_url TEXT;

-- 3. Extend learning_mode CHECK to include 'slide'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_learning_mode_check;
ALTER TABLE users ADD CONSTRAINT users_learning_mode_check
  CHECK (learning_mode IN ('read', 'listen', 'watch', 'slide'));

-- 4. RLS policies for chapter_slides

-- Enable RLS
ALTER TABLE chapter_slides ENABLE ROW LEVEL SECURITY;

-- Select: all authenticated users within the same tenant
CREATE POLICY "chapter_slides_select"
  ON chapter_slides FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Insert: manager, admin, instructor
CREATE POLICY "chapter_slides_insert"
  ON chapter_slides FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'instructor')
      AND tenant_id = chapter_slides.tenant_id
    )
  );

-- Update: manager, admin, instructor
CREATE POLICY "chapter_slides_update"
  ON chapter_slides FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'instructor')
      AND tenant_id = chapter_slides.tenant_id
    )
  );

-- Delete: admin, manager only
CREATE POLICY "chapter_slides_delete"
  ON chapter_slides FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND tenant_id = chapter_slides.tenant_id
    )
  );

-- 5. Updated_at trigger function + trigger
CREATE OR REPLACE FUNCTION set_chapter_slides_updated_at_fn()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_chapter_slides_updated_at
  BEFORE UPDATE ON chapter_slides
  FOR EACH ROW
  EXECUTE FUNCTION set_chapter_slides_updated_at_fn();

COMMIT;
