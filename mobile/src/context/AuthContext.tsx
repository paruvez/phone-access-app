import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSupabase } from './SupabaseContext';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  register: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { supabase, session, user, signIn, signUp, signOut, resetPassword, loading: supabaseLoading } = useSupabase();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsAuthenticated(!!session);
    setLoading(supabaseLoading);
  }, [session, supabaseLoading]);

  const login = async (email: string, password: string) => {
    const result = await signIn(email, password);
    if (!result.error) {
      setIsAuthenticated(true);
    }
    return result;
  };

  const register = async (email: string, password: string) => {
    const result = await signUp(email, password);
    if (!result.error) {
      setIsAuthenticated(true);
    }
    return result;
  };

  const logout = async () => {
    await signOut();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        register,
        logout,
        resetPassword,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}