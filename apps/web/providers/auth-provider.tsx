import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as api from '@/services/api';
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
} from '@/services/auth-storage';

type AuthRoute = '/(tabs)' | '/onboarding';

interface AuthContextValue {
  user: api.AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    passwordConfirmation: string,
  ) => Promise<void>;
  applySession: (session: api.AuthResponse) => void;
  updateCurrentUser: (nextUser: api.AuthUser) => void;
  signOut: () => void;
  getPostAuthRoute: () => Promise<AuthRoute>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<api.AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    api.setAuthToken(null);
    clearStoredSession();
    setToken(null);
    setUser(null);
  }, []);

  const applySession = useCallback((session: api.AuthResponse) => {
    api.setAuthToken(session.access_token);
    saveStoredSession({
      token: session.access_token,
      user: session.user,
    });
    setToken(session.access_token);
    setUser(session.user);
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      const storedSession = loadStoredSession();
      if (!storedSession?.token) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      api.setAuthToken(storedSession.token);
      if (active) {
        setToken(storedSession.token);
        setUser(storedSession.user);
      }

      try {
        const me = await api.getMe();
        if (!active) {
          return;
        }

        saveStoredSession({ token: storedSession.token, user: me });
        setUser(me);
      } catch {
        if (!active) {
          return;
        }
        clearSession();
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, [clearSession]);

  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      clearSession();
    });

    return () => {
      api.setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await api.login(email, password);
      applySession(session);
    },
    [applySession],
  );

  const signUp = useCallback(
    async (email: string, password: string, passwordConfirmation: string) => {
      await api.register(email, password, passwordConfirmation);
    },
    [],
  );

  const updateCurrentUser = useCallback(
    (nextUser: api.AuthUser) => {
      setUser(nextUser);
      if (token) {
        saveStoredSession({ token, user: nextUser });
      }
    },
    [token],
  );

  const signOut = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const getPostAuthRoute = useCallback(async (): Promise<AuthRoute> => {
    try {
      await api.getBodyProfile();
      await api.getActiveMannequin();
      return '/(tabs)';
    } catch (error) {
      if (error instanceof api.ApiError && error.status === 404) {
        return '/onboarding';
      }
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isLoading,
      signIn,
      signUp,
      applySession,
      updateCurrentUser,
      signOut,
      getPostAuthRoute,
    }),
    [user, token, isLoading, signIn, signUp, applySession, updateCurrentUser, signOut, getPostAuthRoute],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
