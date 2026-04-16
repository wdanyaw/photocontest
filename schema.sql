-- Голоса пользователей. UNIQUE(user_id, contest_id) гарантирует один голос на конкурс.
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  contest_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, contest_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_contest ON votes(contest_id);

-- Счётчики голосов (источник правды для подсчёта победителя).
-- Атомарный инкремент через ON CONFLICT.
CREATE TABLE IF NOT EXISTS participant_counts (
  participant_id TEXT NOT NULL,
  contest_id TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  PRIMARY KEY(participant_id, contest_id)
);

-- Кэш fileId фотографий участников.
-- Позволяет пропустить crm.item.get при повторных запросах к /api/photo/:id.
CREATE TABLE IF NOT EXISTS photo_cache (
  participant_id TEXT PRIMARY KEY,
  file_id        TEXT NOT NULL,
  cached_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
