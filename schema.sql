-- Store SEO analysis history
CREATE TABLE IF NOT EXISTS seo_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    analysis_data TEXT NOT NULL,
    score INTEGER,
    recommendations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Store user sessions for memory
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    context TEXT,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX idx_url ON seo_analyses(url);
CREATE INDEX idx_created ON seo_analyses(created_at DESC);