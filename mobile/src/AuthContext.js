// Session management: keeps track of who's logged in and shares it with every screen
// through React Context (so we don't pass "user" through every component by hand).
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from './api';
import { clearToken, loadToken, saveToken } from './storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app start: if a token was saved earlier, use it to restore the session.
  useEffect(() => {
    (async () => {
      try {
        const token = await loadToken();
        if (token) {
          setAuthToken(token);
          const { user: me } = await api.me();
          setUser(me);
        }
      } catch {
        setAuthToken(null);
        await clearToken();  // token expired or invalid
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo(() => {
    async function finish({ token, user: u }) {
      setAuthToken(token);
      await saveToken(token);
      setUser(u);
    }
    return {
      user,
      loading,
      login: async (email, password) => finish(await api.login(email, password)),
      signup: async (email, password, name) => finish(await api.signup(email, password, name)),
      logout: async () => { setAuthToken(null); await clearToken(); setUser(null); },
      setUser,
    };
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
