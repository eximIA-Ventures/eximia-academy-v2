-- Gamification: XP, streaks, badges
CREATE TABLE IF NOT EXISTS user_gamification (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  current_streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  badges JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for leaderboard queries
CREATE INDEX idx_gamification_tenant_xp ON user_gamification(tenant_id, xp DESC);
CREATE INDEX idx_gamification_tenant_streak ON user_gamification(tenant_id, current_streak DESC);

-- RLS
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;

-- Students view their own
CREATE POLICY "students_view_own_gamification" ON user_gamification
  FOR SELECT USING (auth.uid() = user_id);

-- All users in same tenant can view leaderboard
CREATE POLICY "tenant_leaderboard" ON user_gamification
  FOR SELECT USING (
    tenant_id IN (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid())
  );

-- System can upsert
CREATE POLICY "service_upsert_gamification" ON user_gamification
  FOR ALL USING (true) WITH CHECK (true);

-- XP reward values
COMMENT ON TABLE user_gamification IS 'XP system: session_completed=50xp, chapter_completed=100xp, course_completed=500xp, quiz_perfect=200xp, streak_bonus=10xp/day';

-- Level thresholds: L1=0, L2=500, L3=1500, L4=3000, L5=5000, L6=8000, L7=12000, L8=17000, L9=23000, L10=30000
