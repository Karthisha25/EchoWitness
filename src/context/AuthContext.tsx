import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { ensureUserProfile, getUserProfile } from '@/services/incidents';
import type { UserProfile } from '@/types';

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInAnonymous: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const nextProfile = await getUserProfile(user.uid);
    setProfile(nextProfile);
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const nextProfile = await ensureUserProfile(nextUser.uid);
        setProfile(nextProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInAnonymous = useCallback(async () => {
    await signInAnonymously(auth);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signInAnonymous,
      logout,
      refreshProfile,
    }),
    [user, profile, loading, signInAnonymous, logout, refreshProfile],
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
