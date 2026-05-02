-- =============================================================
-- Fix: Add teacher role to chapter-assets Storage policies
-- Ref: QA FIX-12.3-002
-- =============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "chapter_assets_upload" ON storage.objects;
DROP POLICY IF EXISTS "chapter_assets_delete" ON storage.objects;

-- Recreate upload policy with teacher included
CREATE POLICY "chapter_assets_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chapter-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'teacher')
    )
  );

-- Recreate delete policy with teacher included
CREATE POLICY "chapter_assets_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chapter-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'teacher')
    )
  );
