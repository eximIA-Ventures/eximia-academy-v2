-- =============================================================
-- Epic 12: Multi-Modal Content Delivery
-- Story 12.1: Schema + Storage Bucket
-- =============================================================

-- 1. Add media columns to chapters (additive-only, no drops)
ALTER TABLE chapters ADD COLUMN video_url TEXT;
ALTER TABLE chapters ADD COLUMN audio_url TEXT;
-- 2. Add learning preference to users
ALTER TABLE users ADD COLUMN learning_mode TEXT DEFAULT 'read'
  CHECK (learning_mode IN ('read', 'listen', 'watch'));
-- 3. Storage bucket for chapter assets (images + audio)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chapter-assets', 'chapter-assets', true);
-- 4. Storage RLS: authenticated users can read
CREATE POLICY "chapter_assets_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chapter-assets' AND auth.role() = 'authenticated');
-- 5. Storage RLS: managers/admins can upload
CREATE POLICY "chapter_assets_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chapter-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
-- 6. Storage RLS: managers/admins can delete
CREATE POLICY "chapter_assets_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chapter-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
