-- Add cover_image_url to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
COMMENT ON COLUMN courses.cover_image_url IS 'URL for the course cover image displayed on cards and detail pages';
