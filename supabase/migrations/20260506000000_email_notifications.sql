-- Email notifications: manager sends deadline reminders and announcements to students

CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  -- Optional: link to a course/trail deadline
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  trail_id UUID REFERENCES learning_trails(id) ON DELETE SET NULL,
  deadline DATE,
  -- Recipients snapshot (emails sent to, for audit)
  recipient_count INTEGER NOT NULL DEFAULT 0,
  recipients JSONB NOT NULL DEFAULT '[]',
  -- Status
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'failed')),
  -- Resend metadata
  resend_batch_id TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_email_notifications_tenant ON email_notifications(tenant_id);
CREATE INDEX idx_email_notifications_sender ON email_notifications(sender_id);
CREATE INDEX idx_email_notifications_sent_at ON email_notifications(sent_at DESC);

-- RLS
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Managers and admins can see notifications they sent
CREATE POLICY "managers_view_own_notifications" ON email_notifications
  FOR SELECT USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'manager')
      AND u.tenant_id = email_notifications.tenant_id
    )
  );

-- Only managers and admins can insert
CREATE POLICY "managers_insert_notifications" ON email_notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'manager')
      AND u.tenant_id = email_notifications.tenant_id
    )
  );
