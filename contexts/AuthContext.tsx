import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { authService } from '../services/auth';
import { sheetsApi } from '../services/sheetsApi';
import { storage } from '../services/storage';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  spreadsheetId: string | null;
  signIn: (clientId: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSpreadsheetId: (id: string | null) => void;
  createSpreadsheet: () => Promise<string>;
  connectSpreadsheet: (urlOrId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetIdState] = useState<string | null>(null);

  // Initialize from stored state
  useEffect(() => {
    const storedUser = authService.getUser();
    const config = storage.getConfig();

    if (storedUser) {
      setUser(storedUser);
    }
    if (config.spreadsheetId) {
      setSpreadsheetIdState(config.spreadsheetId);
    }

    setIsLoading(false);
  }, []);

  const signIn = useCallback(async (clientId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const newUser = await authService.signIn(clientId);
      setUser(newUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);

    try {
      await authService.signOut();
      setUser(null);
      // Don't clear spreadsheetId - user might want to reconnect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setSpreadsheetId = useCallback((id: string | null) => {
    setSpreadsheetIdState(id);

    // Persist to config
    const config = storage.getConfig();
    storage.saveConfig({ ...config, spreadsheetId: id });
  }, []);

  const createSpreadsheet = useCallback(async (): Promise<string> => {
    if (!user?.accessToken) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      const newSpreadsheetId = await sheetsApi.createSpreadsheet(user.accessToken, 'FinFree Data');
      setSpreadsheetId(newSpreadsheetId);
      return newSpreadsheetId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create spreadsheet');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, setSpreadsheetId]);

  const connectSpreadsheet = useCallback(async (urlOrId: string) => {
    if (!user?.accessToken) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Extract ID if URL was provided
      let id = urlOrId;
      if (urlOrId.includes('docs.google.com')) {
        const extracted = sheetsApi.extractSpreadsheetId(urlOrId);
        if (!extracted) {
          throw new Error('Invalid Google Sheets URL');
        }
        id = extracted;
      }

      // Verify we can access it
      await sheetsApi.getSpreadsheet(user.accessToken, id);

      setSpreadsheetId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect spreadsheet');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, setSpreadsheetId]);

  const value: AuthContextType = {
    user,
    isLoading,
    error,
    spreadsheetId,
    signIn,
    signOut,
    setSpreadsheetId,
    createSpreadsheet,
    connectSpreadsheet
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
