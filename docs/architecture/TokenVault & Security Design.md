# TokenVault & Security Design

This document details the security architecture of the TokenVault system, which is responsible for securely storing and managing credentials for various model providers in the Hybrid Thinking platform.

## Overview

The TokenVault is a critical security component that:

1. Securely stores API keys, OAuth tokens, and browser session tokens
2. Manages token refresh operations
3. Implements circuit breaker patterns for authentication failures
4. Provides secure access to credentials for adapters

## Database Schema

### TokenRecords Table

```sql
CREATE TABLE TokenRecords (
  id            TEXT PRIMARY KEY,        -- UUID
  userId        TEXT NOT NULL,           -- UUID of user
  providerId    TEXT NOT NULL,           -- e.g., "openai", "browser:chatgpt"
  encryptedPayload BLOB NOT NULL,        -- AES-256-GCM ciphertext
  iv            BLOB NOT NULL,           -- Initialization vector
  updatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, providerId)
);
```

## Encryption Implementation

The TokenVault uses AES-256-GCM for encrypting sensitive credential data:

```typescript
import * as crypto from 'crypto';

// Environment variables or secure configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes (256 bits)
if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
  throw new Error('Invalid encryption key. Must be 32 bytes (64 hex characters)');
}

/**
 * Encrypt token data
 * @param data Object to encrypt
 * @returns Encrypted data and IV
 */
function encryptTokenData(data: any): { encryptedData: Buffer; iv: Buffer } {
  // Generate random IV for each encryption
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  // Encrypt data
  const jsonData = JSON.stringify(data);
  const encryptedData = Buffer.concat([
    cipher.update(jsonData, 'utf8'),
    cipher.final()
  ]);
  
  // Get auth tag and append to encrypted data
  const authTag = cipher.getAuthTag();
  const encryptedBuffer = Buffer.concat([encryptedData, authTag]);
  
  return { encryptedData: encryptedBuffer, iv };
}

/**
 * Decrypt token data
 * @param encryptedData Encrypted data buffer
 * @param iv Initialization vector
 * @returns Decrypted data object
 */
function decryptTokenData(encryptedData: Buffer, iv: Buffer): any {
  try {
    // Extract auth tag (last 16 bytes)
    const authTag = encryptedData.slice(encryptedData.length - 16);
    const ciphertext = encryptedData.slice(0, encryptedData.length - 16);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    // Set auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    // Parse JSON
    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}
```

## TokenVault Class

```typescript
import { TokenData } from '../common-types';
import { Database } from 'sqlite3';
import { EventEmitter } from 'events';

class TokenVault {
  private db: Database;
  private eventEmitter: EventEmitter;
  
  // In-memory state for refresh operations
  private refreshPromises: Map<string, Promise<TokenData>> = new Map();
  private failureCount: Map<string, number> = new Map();
  private circuitState: Map<string, 'closed' | 'open' | 'half-open'> = new Map();
  
  constructor(db: Database, eventEmitter: EventEmitter) {
    this.db = db;
    this.eventEmitter = eventEmitter;
  }
  
  /**
   * Store a token for a user and provider
   * @param userId User ID
   * @param providerId Provider ID
   * @param tokenData Token data
   * @returns Promise resolving when token is stored
   */
  async storeToken(
    userId: string,
    providerId: string,
    tokenData: TokenData
  ): Promise<void> {
    // Generate ID
    const id = crypto.randomUUID();
    
    // Encrypt token data
    const { encryptedData, iv } = encryptTokenData(tokenData);
    
    // Store in database
    await new Promise<void>((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO TokenRecords (id, userId, providerId, encryptedPayload, iv, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          providerId,
          encryptedData,
          iv,
          new Date().toISOString()
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Reset circuit breaker if it was open
    const key = `${userId}|${providerId}`;
    this.failureCount.set(key, 0);
    this.circuitState.set(key, 'closed');
  }
  
  /**
   * Get a valid token for a user and provider
   * @param userId User ID
   * @param providerId Provider ID
   * @returns Promise resolving to token data
   */
  async getValidToken(userId: string, providerId: string): Promise<TokenData> {
    const key = `${userId}|${providerId}`;
    
    // Check circuit breaker
    if (this.circuitState.get(key) === 'open') {
      throw new Error(`Authentication circuit is open for ${providerId}`);
    }
    
    // Check if a refresh is already in progress
    const existingPromise = this.refreshPromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }
    
    // Get token from database
    const tokenRecord = await this.getTokenRecord(userId, providerId);
    if (!tokenRecord) {
      throw new Error(`No token found for ${providerId}`);
    }
    
    // Decrypt token data
    const tokenData = decryptTokenData(
      tokenRecord.encryptedPayload,
      tokenRecord.iv
    );
    
    // Check if token is expired
    const now = Date.now();
    if (tokenData.expiresAt && tokenData.expiresAt <= now) {
      // Token is expired, refresh it
      return this.refreshToken(userId, providerId, tokenData);
    }
    
    // Token is valid
    return tokenData;
  }
  
  /**
   * Refresh an expired token
   * @param userId User ID
   * @param providerId Provider ID
   * @param tokenData Expired token data
   * @returns Promise resolving to refreshed token data
   */
  private async refreshToken(
    userId: string,
    providerId: string,
    tokenData: TokenData
  ): Promise<TokenData> {
    const key = `${userId}|${providerId}`;
    
    // Create refresh promise
    const refreshPromise = (async () => {
      try {
        // Get refresh function for this provider
        const refreshFunction = this.getRefreshFunction(providerId);
        if (!refreshFunction) {
          throw new Error(`No refresh function for ${providerId}`);
        }
        
        // Refresh token
        const newTokenData = await refreshFunction(tokenData);
        
        // Store new token
        await this.storeToken(userId, providerId, newTokenData);
        
        // Reset failure count and close circuit
        this.failureCount.set(key, 0);
        this.circuitState.set(key, 'closed');
        
        // Emit event
        this.eventEmitter.emit('tokenRefreshed', {
          userId,
          providerId
        });
        
        return newTokenData;
      } catch (error) {
        // Increment failure count
        const failures = (this.failureCount.get(key) || 0) + 1;
        this.failureCount.set(key, failures);
        
        // Open circuit after 3 failures
        if (failures >= 3) {
          this.circuitState.set(key, 'open');
          
          // Schedule circuit reset after 30 seconds
          setTimeout(() => {
            if (this.circuitState.get(key) === 'open') {
              this.circuitState.set(key, 'half-open');
            }
          }, 30000);
          
          // Emit event
          this.eventEmitter.emit('reauthRequired', {
            userId,
            providerId,
            reason: 'Token refresh failed multiple times'
          });
        }
        
        throw error;
      } finally {
        // Remove promise from map
        this.refreshPromises.delete(key);
      }
    })();
    
    // Store promise
    this.refreshPromises.set(key, refreshPromise);
    
    return refreshPromise;
  }
  
  /**
   * Delete a token
   * @param userId User ID
   * @param providerId Provider ID
   * @returns Promise resolving when token is deleted
   */
  async deleteToken(userId: string, providerId: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.db.run(
        'DELETE FROM TokenRecords WHERE userId = ? AND providerId = ?',
        [userId, providerId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Clear in-memory state
    const key = `${userId}|${providerId}`;
    this.refreshPromises.delete(key);
    this.failureCount.delete(key);
    this.circuitState.delete(key);
  }
  
  /**
   * Get a token record from the database
   * @param userId User ID
   * @param providerId Provider ID
   * @returns Promise resolving to token record or null
   */
  private async getTokenRecord(
    userId: string,
    providerId: string
  ): Promise<{ encryptedPayload: Buffer; iv: Buffer } | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT encryptedPayload, iv FROM TokenRecords WHERE userId = ? AND providerId = ?',
        [userId, providerId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              encryptedPayload: row.encryptedPayload,
              iv: row.iv
            });
          }
        }
      );
    });
  }
  
  /**
   * Get refresh function for a provider
   * @param providerId Provider ID
   * @returns Refresh function or null
   */
  private getRefreshFunction(
    providerId: string
  ): ((tokenData: TokenData) => Promise<TokenData>) | null {
    // Provider-specific refresh functions
    const refreshFunctions: Record<
      string,
      (tokenData: TokenData) => Promise<TokenData>
    > = {
      // OpenAI doesn't need refresh (API key based)
      'openai': null,
      
      // Anthropic doesn't need refresh (API key based)
      'anthropic': null,
      
      // OAuth-based providers
      'azure': this.refreshAzureToken,
      
      // Browser-based providers don't support refresh
      'browser:chatgpt': null,
      'browser:claude': null,
      'browser:perplexity': null
    };
    
    return refreshFunctions[providerId] || null;
  }
  
  /**
   * Refresh an Azure token
   * @param tokenData Expired token data
   * @returns Promise resolving to refreshed token data
   */
  private async refreshAzureToken(tokenData: TokenData): Promise<TokenData> {
    // Implementation would use Azure OAuth refresh token flow
    // This is a placeholder
    
    throw new Error('Azure token refresh not implemented');
    
    // Example implementation:
    /*
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET,
        refresh_token: tokenData.refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Azure token refresh failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      ...tokenData,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokenData.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      issuedAt: Date.now()
    };
    */
  }
}
```

## Circuit Breaker Pattern

The TokenVault implements a circuit breaker pattern to prevent repeated authentication failures:

1. **Closed State**: Normal operation, token requests proceed
2. **Open State**: After 3 consecutive failures, token requests are blocked
3. **Half-Open State**: After a timeout (30 seconds), allows one test request

```
┌─────────┐     failure     ┌─────────┐     timeout     ┌───────────┐
│         │ ──────────────> │         │ ──────────────> │           │
│ Closed  │                 │  Open   │                 │ Half-Open │
│         │ <────────────── │         │ <────────────── │           │
└─────────┘     success     └─────────┘     failure     └───────────┘
```

## Token Types and Storage

The TokenVault handles different types of credentials:

### API Keys

```json
{
  "accessToken": "sk-1234567890abcdef",
  "providerId": "openai",
  "type": "api"
}
```

### OAuth Tokens

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": 1717574400000,
  "issuedAt": 1717570800000,
  "providerId": "azure",
  "type": "oauth",
  "scopes": ["https://cognitiveservices.azure.com/.default"]
}
```

### Browser Session Tokens

```json
{
  "accessToken": "sessionToken123",
  "expiresAt": 1717574400000,
  "issuedAt": 1717570800000,
  "providerId": "browser:chatgpt",
  "type": "browser",
  "metadata": {
    "cookies": "serialized-cookies-string"
  }
}
```

## Security Best Practices

### Key Management

1. **Encryption Key Storage**:
   - The encryption key is stored in environment variables or a secure key management system (e.g., AWS KMS, HashiCorp Vault)
   - The key is never stored in the codebase or configuration files

2. **Key Rotation**:
   - [TODO: Define key rotation policy and implementation]
   - Implement a mechanism to re-encrypt all tokens when the encryption key is rotated

### Access Control

1. **User Isolation**:
   - Each user's tokens are isolated and can only be accessed with their userId
   - No cross-user token access is possible

2. **Principle of Least Privilege**:
   - TokenVault methods only expose the minimum functionality needed
   - Internal methods are private and not exposed to other components

### Audit and Monitoring

1. **Access Logging**:
   - All token access attempts are logged (success and failure)
   - Logs include timestamp, userId, providerId, and operation type (but not token values)

2. **Anomaly Detection**:
   - Unusual access patterns trigger alerts
   - Multiple failed access attempts are monitored

## Error Handling

### Common Error Scenarios

1. **Token Not Found**:
   - User has not provided credentials for the requested provider
   - Return clear error message prompting user to authenticate

2. **Token Refresh Failed**:
   - OAuth refresh token is invalid or expired
   - Circuit breaker opens after multiple failures
   - User is prompted to re-authenticate

3. **Decryption Failed**:
   - Encryption key has been rotated but tokens weren't re-encrypted
   - Data corruption in the database
   - Return error and log for investigation

## Implementation Considerations

### Database Transactions

For operations that require multiple database queries, use transactions to ensure atomicity:

```typescript
async function atomicOperation(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.db.serialize(() => {
      this.db.run('BEGIN TRANSACTION');
      
      try {
        // Multiple database operations
        
        this.db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (error) {
        this.db.run('ROLLBACK');
        reject(error);
      }
    });
  });
}
```

### Concurrency Handling

The TokenVault uses promise sharing to prevent duplicate refresh operations:

```typescript
// Check if a refresh is already in progress
const existingPromise = this.refreshPromises.get(key);
if (existingPromise) {
  return existingPromise;
}

// Create new refresh promise
const refreshPromise = (async () => {
  // Refresh logic
})();

// Store promise
this.refreshPromises.set(key, refreshPromise);

return refreshPromise;
```

## Future Enhancements

[TODO: Define specific security enhancements for future versions]

1. **Hardware Security Module (HSM) Integration**:
   - Store encryption keys in HSM for enhanced security
   - Use HSM for cryptographic operations

2. **Multi-Region Support**:
   - Replicate encrypted tokens across regions
   - Implement region-specific encryption keys

3. **Advanced Threat Protection**:
   - Implement behavioral analysis for token usage
   - Add rate limiting for token access
