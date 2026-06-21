export type SecureMode = 'plain' | 'secure';

export interface SecureSession {
  mode: SecureMode;
  password: string | null;
  payload?: string;
}
