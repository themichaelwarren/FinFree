import { UserProfile } from '../types';

const STORAGE_KEY = 'finfree_user';
const CLIENT_ID_KEY = 'finfree_oauth_client_id';

// Google OAuth scopes
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; expires_in: number; error?: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
          revoke: (token: string, callback: () => void) => void;
        };
      };
    };
  }
}

let tokenClient: ReturnType<typeof window.google.accounts.oauth2.initTokenClient> | null = null;

export const authService = {
  // Get stored user
  getUser: (): UserProfile | null => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
      const user = JSON.parse(stored) as UserProfile;
      // Check if token is expired (with 5 min buffer)
      if (user.expiresAt < Date.now() + 300000) {
        return null;
      }
      return user;
    } catch {
      return null;
    }
  },

  // Store user
  saveUser: (user: UserProfile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  },

  // Clear user
  clearUser: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Check if authenticated
  isAuthenticated: (): boolean => {
    return authService.getUser() !== null;
  },

  // Get access token
  getAccessToken: (): string | null => {
    const user = authService.getUser();
    return user?.accessToken || null;
  },

  // Get OAuth client ID from settings
  getClientId: (): string => {
    return localStorage.getItem(CLIENT_ID_KEY) || '';
  },

  // Save OAuth client ID
  setClientId: (clientId: string) => {
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  },

  // Initialize token client (must be called after GIS script loads)
  initClient: (clientId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services not loaded'));
        return;
      }

      try {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: () => {} // Will be set in signIn
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  // Sign in with Google
  signIn: (clientId: string): Promise<UserProfile> => {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services not loaded. Please refresh the page.'));
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }

          try {
            // Fetch user info
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` }
            });

            if (!userInfoResponse.ok) {
              throw new Error('Failed to fetch user info');
            }

            const userInfo = await userInfoResponse.json();
            const expiresAt = Date.now() + (response.expires_in * 1000);

            const user: UserProfile = {
              id: userInfo.id,
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              accessToken: response.access_token,
              expiresAt
            };

            authService.saveUser(user);
            authService.setClientId(clientId);
            resolve(user);
          } catch (error) {
            reject(error);
          }
        }
      });

      client.requestAccessToken();
    });
  },

  // Sign out
  signOut: async (): Promise<void> => {
    const user = authService.getUser();

    if (user?.accessToken && window.google?.accounts?.oauth2) {
      return new Promise((resolve) => {
        window.google!.accounts.oauth2.revoke(user.accessToken, () => {
          authService.clearUser();
          resolve();
        });
      });
    }

    authService.clearUser();
  },

  // Refresh token (re-authenticate silently if possible)
  refreshToken: async (): Promise<string | null> => {
    const clientId = authService.getClientId();
    if (!clientId) return null;

    try {
      const user = await authService.signIn(clientId);
      return user.accessToken;
    } catch {
      return null;
    }
  }
};
