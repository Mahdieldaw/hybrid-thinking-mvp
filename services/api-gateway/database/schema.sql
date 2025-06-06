-- TokenRecords Table
CREATE TABLE IF NOT EXISTS TokenRecords (
  id TEXT PRIMARY KEY, -- UUID
  userId TEXT NOT NULL, -- UUID of user
  providerId TEXT NOT NULL, -- e.g., "openai", "browser:chatgpt"
  encryptedPayload BLOB NOT NULL, -- AES-256-GCM ciphertext
  iv BLOB NOT NULL, -- Initialization vector for encryption
  salt BLOB NOT NULL, -- Salt for PBKDF2 key derivation
  tag BLOB NOT NULL, -- Authentication tag for GCM
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, providerId)
);

-- PromptLogs Table
CREATE TABLE IF NOT EXISTS PromptLogs (
  jobId TEXT PRIMARY KEY, -- UUID
  userId TEXT NOT NULL, -- UUID of the requester
  workflowName TEXT, -- If triggered by YAML
  promptText TEXT, -- Raw prompt or YAML-generated prompt
  requestedModels TEXT NOT NULL, -- JSON array text (e.g., '["claude-sonnet","browser:chatgpt"]')
  results TEXT NOT NULL, -- JSON object mapping modelId → text|null
  synthesisResult TEXT, -- Final synthesis text (nullable)
  status TEXT NOT NULL, -- ENUM: 'pending','generating','synthesizing','done','failed'
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  errorInfo TEXT -- Error message if failed
);
