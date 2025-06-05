/// <reference types="node" />
import { TokenData } from '@hybrid-thinking/common-types';
import { Database } from 'sqlite3';
import { EventEmitter } from 'events';
/**
 * TokenVaultService securely stores and manages credentials for model providers.
 * Implements circuit breaker, refresh, and encryption logic.
 */
export declare class TokenVaultService {
    private db;
    private eventEmitter;
    private refreshPromises;
    private failureCount;
    private circuitState;
    constructor(db: Database, eventEmitter: EventEmitter);
    /**
     * Store a token for a user and provider (pseudo-code, see docs for details)
     */
    storeToken(userId: string, providerId: string, tokenData: TokenData): Promise<void>;
    /**
     * Get a valid token for a user and provider (pseudo-code, see docs for details)
     */
    getValidToken(userId: string, providerId: string): Promise<TokenData>;
    /**
     * Delete a token for a user and provider (pseudo-code, see docs for details)
     */
    deleteToken(userId: string, providerId: string): Promise<void>;
}
