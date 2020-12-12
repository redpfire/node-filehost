--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS files(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url VARCHAR(64) NOT NULL,
    hash VARCHAR(1024) NOT NULL UNIQUE,
    removed BOOLEAN DEFAULT false,
    ip VARCHAR(64) NOT NULL,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);
