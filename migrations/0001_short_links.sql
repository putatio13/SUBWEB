-- Compatible with an empty database and the original prototype's links table.
-- Apply once using Wrangler migrations; existing links and logs are preserved.
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    slug TEXT NOT NULL,
    ip TEXT,
    status INTEGER DEFAULT 1,
    ua TEXT,
    create_time TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
CREATE INDEX IF NOT EXISTS idx_links_url ON links(url);
ALTER TABLE links ADD COLUMN expires_at INTEGER;

CREATE TABLE IF NOT EXISTS short_link_rate_limits (
    client TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    requests INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (client, bucket)
);
CREATE INDEX IF NOT EXISTS idx_short_link_rate_expiry ON short_link_rate_limits(expires_at);
