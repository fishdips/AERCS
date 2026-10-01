import { createContext, useCallback, useEffect, useState } from 'react';
import { getMe, logout as apiLogout } from '../api/auth';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // True right after an explicit logout. The route guards check it so they don't
  // record the page being left as a "return here after login" target - otherwise
  // the next person to sign in (possibly a different role) is sent back to it.
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    if (user) setLoggedOut(false);
  }, [user]);

  // Checked once on mount (and after login/logout) so an existing session
  // cookie keeps the user signed in across a page refresh, instead of
  // forcing a fresh login every time the app reloads.
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await getMe();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await apiLogout();
    setLoggedOut(true);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, loggedOut, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
