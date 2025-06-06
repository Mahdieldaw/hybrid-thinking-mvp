import { Database } from 'sqlite'; // Using sqlite instead of sqlite3 directly for promise support
import { encrypt, decrypt } from '../utils/encryption';
import { v4 as uuidv4 } from 'uuid';

// This interface should align with what's stored and expected by common-types if possible,
// but here it's specific to the service's needs for storing/retrieving.
export interface StoredTokenData {
  id: string;
  userId: string;
  providerId: string;
  credentialType: string; // e.g., 'api_key', 'oauth_refresh_token'
  encryptedCredentials: string; // The encrypted JSON string of credentials
  iv: string; // Initialization Vector used for encryption
  isValid: boolean; // Indicates if the token is currently considered valid
  lastChecked: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DecryptedTokenCredentials {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // Timestamp
  // other provider-specific fields
}

export class TokenVaultService {
  private db: Database;
  // EventEmitter might be added back if needed for cross-service events
  // For now, focusing on core DB and encryption logic.

  constructor(db: Database) {
    this.db = db;
  }

  async storeToken(
    userId: string,
    providerId: string,
    credentialType: string,
    credentials: DecryptedTokenCredentials, // The actual sensitive data
    encryptionKey: string // User-specific key for an extra layer of security
  ): Promise<void> {
    const id = uuidv4();
    const { encryptedData, iv } = encrypt(JSON.stringify(credentials), encryptionKey);
    const now = new Date();

    try {
      await this.db.run(
        `INSERT INTO TokenRecords (id, userId, providerId, credentialType, encryptedCredentials, iv, isValid, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, // isValid defaults to true on new token
        id, userId, providerId, credentialType, encryptedData, iv, true, now.toISOString(), now.toISOString()
      );
      console.log(`Token stored for user ${userId}, provider ${providerId}`);
    } catch (error) {
      console.error('Error storing token in DB:', error);
      throw new Error('Failed to store token due to a database error.');
    }
  }

  async getValidToken(
    userId: string,
    providerId: string,
    encryptionKey: string
  ): Promise<DecryptedTokenCredentials | null> {
    try {
      const row = await this.db.get<StoredTokenData>(
        'SELECT * FROM TokenRecords WHERE userId = ? AND providerId = ? AND isValid = 1',
        userId, providerId
      );

      if (!row) {
        console.log(`No valid token found for user ${userId}, provider ${providerId}`);
        return null;
      }

      const decryptedCredentialsJson = decrypt(row.encryptedCredentials, encryptionKey, row.iv);
      const credentials = JSON.parse(decryptedCredentialsJson) as DecryptedTokenCredentials;

      // [TODO: Implement token expiry check and refresh logic here if applicable]
      // For example, if credentials contain an expiresAt field:
      // if (credentials.expiresAt && Date.now() >= credentials.expiresAt) {
      //   console.log(`Token for ${userId}/${providerId} has expired. Attempting refresh...`);
      //   // return this.refreshToken(userId, providerId, credentials, encryptionKey);
      //   await this.invalidateToken(userId, providerId); // Mark as invalid if refresh fails or not implemented
      //   return null; // Or throw an error indicating expiry
      // }

      return credentials;
    } catch (error) {
      console.error(`Error retrieving or decrypting token for user ${userId}, provider ${providerId}:`, error);
      // Potentially invalidate token if decryption fails repeatedly (could indicate key mismatch or corruption)
      throw new Error('Failed to retrieve or decrypt token.');
    }
  }

  async listTokens(userId: string, encryptionKey: string): Promise<Partial<StoredTokenData>[]> {
    try {
      const rows = await this.db.all<StoredTokenData[]>(
        'SELECT id, userId, providerId, credentialType, isValid, lastChecked, createdAt, updatedAt FROM TokenRecords WHERE userId = ?',
        userId
      );
      // For listing, we don't decrypt credentials, just return metadata.
      // If specific decrypted fields were needed, it would require careful consideration of security.
      return rows.map(row => ({
        id: row.id,
        userId: row.userId,
        providerId: row.providerId,
        credentialType: row.credentialType,
        isValid: row.isValid,
        lastChecked: row.lastChecked ? new Date(row.lastChecked) : null,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } catch (error) {
      console.error(`Error listing tokens for user ${userId}:`, error);
      throw new Error('Failed to list tokens.');
    }
  }

  async deleteToken(userId: string, providerId: string): Promise<void> {
    try {
      const result = await this.db.run(
        'DELETE FROM TokenRecords WHERE userId = ? AND providerId = ?',
        userId, providerId
      );
      if (result.changes === 0) {
        console.warn(`No token found to delete for user ${userId}, provider ${providerId}`);
      } else {
        console.log(`Token deleted for user ${userId}, provider ${providerId}`);
      }
    } catch (error) {
      console.error('Error deleting token from DB:', error);
      throw new Error('Failed to delete token due to a database error.');
    }
  }

  async invalidateToken(userId: string, providerId: string): Promise<void> {
    try {
      await this.db.run(
        'UPDATE TokenRecords SET isValid = 0, updatedAt = ? WHERE userId = ? AND providerId = ?',
        new Date().toISOString(), userId, providerId
      );
      console.log(`Token invalidated for user ${userId}, provider ${providerId}`);
    } catch (error) {
      console.error('Error invalidating token in DB:', error);
      throw new Error('Failed to invalidate token due to a database error.');
    }
  }

  // [TODO: Implement refreshToken logic if providers support it and it's needed]
  // async refreshToken(userId: string, providerId: string, currentCredentials: DecryptedTokenCredentials, encryptionKey: string): Promise<DecryptedTokenCredentials> {
  //   // 1. Use currentCredentials.refreshToken to get a new accessToken
  //   // 2. Update the stored token with new accessToken and new expiry
  //   // 3. Return new credentials
  //   throw new Error('Refresh token logic not implemented.');
  // }

  // [TODO: Circuit breaker logic might be added if direct API calls are made from here for refresh]
}
