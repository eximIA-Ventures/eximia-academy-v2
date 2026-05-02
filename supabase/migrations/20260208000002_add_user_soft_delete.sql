-- Story 6.4: Add soft delete support for LGPD compliance
-- IMPORTANT: This migration must run AFTER 20260208000001_remove_dual_mode.sql

ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE enrollments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Allow sessions.student_id to be NULL for LGPD anonymization (right to erasure).
-- When a user is deleted, their sessions are preserved for analytics but student_id is set to NULL.
ALTER TABLE sessions ALTER COLUMN student_id DROP NOT NULL;

-- Index optimized for active user queries (most common case)
CREATE INDEX idx_users_not_deleted ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_enrollments_not_deleted ON enrollments(student_id) WHERE deleted_at IS NULL;
