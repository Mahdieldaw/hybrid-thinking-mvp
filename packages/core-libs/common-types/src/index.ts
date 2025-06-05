// Common types for Hybrid Thinking platform
export interface TokenData {
  provider: string;
  token: string;
  expiresAt?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
}
