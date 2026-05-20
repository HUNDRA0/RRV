-- WebAuthn / Passkeys.
-- Each row is one credential bound to one user. A user can register
-- multiple passkeys (iPhone, MacBook, Windows Hello, etc.).
--
-- credential_id is the WebAuthn credential identifier (raw bytes, stored
-- base64url-encoded to keep it readable in queries).
-- public_key is the COSE_Key encoded public key bytes (CBOR).
-- counter is the WebAuthn signature counter (clone-detection); some
--   authenticators always return 0 — that's allowed by the spec.
-- transports is a comma-separated list ("internal", "hybrid", "usb") that
--   the browser passes back; we use it to optimize allowCredentials hints.

CREATE TABLE passkeys (
  credential_id  TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key     BLOB NOT NULL,
  counter        INTEGER NOT NULL DEFAULT 0,
  device_label   TEXT NOT NULL DEFAULT '',
  transports     TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at   TEXT
);
CREATE INDEX idx_passkeys_user ON passkeys(user_id);
