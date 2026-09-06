import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { getSupabaseAuthErrorMessage } from '../utils/supabaseAuthErrors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginError: string | null;
  isConfigured: boolean;
  isEmailVerified: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);

  // Busca o perfil em public.profiles (criado pelo trigger handle_new_user no signup)
  const fetchProfile = useCallback(async (supaUser: User): Promise<UserProfile> => {
    StorageService.setActiveUser(supaUser.id);

    const fallbackProfile: UserProfile = {
      uid: supaUser.id,
      email: supaUser.email || null,
      displayName: supaUser.user_metadata?.display_name || 'Estudante SynapseMed',
      photoURL: supaUser.user_metadata?.avatar_url || null,
      role: 'student',
      plan: 'free',
      status: 'pending',
    };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url, role, status, created_at')
        .eq('id', supaUser.id)
        .single();

      if (error || !data) {
        console.warn('Não foi possível carregar o perfil em public.profiles:', error);
        return fallbackProfile;
      }

      return {
        uid: data.id,
        email: data.email,
        displayName: data.display_name || 'Estudante SynapseMed',
        photoURL: data.avatar_url,
        // plan ainda não existe em public.profiles (fora do escopo desta etapa) — mantido 'free'.
        role: data.role === 'admin' ? 'admin' : 'student',
        plan: 'free',
        status: data.status === 'active' || data.status === 'blocked' ? data.status : 'pending',
        createdAt: data.created_at,
      };
    } catch (err: any) {
      console.error('Erro ao sincronizar perfil do Supabase:', err);
      return fallbackProfile;
    }
  }, []);

  const applySession = useCallback(
    async (supaUser: User | null) => {
      if (supaUser) {
        setUser(supaUser);
        setIsEmailVerified(Boolean(supaUser.email_confirmed_at));
        const nextProfile = await fetchProfile(supaUser);
        setProfile(nextProfile);
      } else {
        StorageService.setActiveUser(null);
        setUser(null);
        setProfile(null);
        setIsEmailVerified(false);
      }
    },
    [fetchProfile]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      try {
        await applySession(session?.user ?? null);
      } catch (err: any) {
        console.error('Erro ao processar sessão inicial:', err);
        setLoginError(getSupabaseAuthErrorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        await applySession(session?.user ?? null);
      } catch (err: any) {
        console.error('Erro ao processar alteração de autenticação:', err);
        setLoginError(getSupabaseAuthErrorMessage(err));
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const loginWithGoogle = async () => {
    setLoginError(null);
    if (!isSupabaseConfigured) {
      setLoginError(
        'As variáveis do Supabase ainda não foram configuradas no ambiente. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.'
      );
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (err: any) {
      console.error('Falha na autenticação com o Google:', err);
      setLoginError(getSupabaseAuthErrorMessage(err));
      throw err;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setLoginError(null);
    if (!isSupabaseConfigured) {
      setLoginError('O Supabase ainda não está configurado. Verifique as credenciais no arquivo .env.local.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.user) {
        await applySession(data.user);
      }
    } catch (err: any) {
      const ptMsg = getSupabaseAuthErrorMessage(err);
      setLoginError(ptMsg);
      throw new Error(ptMsg);
    }
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    setLoginError(null);
    if (!isSupabaseConfigured) {
      setLoginError('O Supabase ainda não está configurado. Verifique as credenciais no arquivo .env.local.');
      return;
    }

    try {
      // O trigger public.handle_new_user cria a linha em public.profiles
      // automaticamente a partir de raw_user_meta_data.display_name.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name.trim() },
        },
      });
      if (error) throw error;
      if (data.user) {
        await applySession(data.user);
      }
    } catch (err: any) {
      const ptMsg = getSupabaseAuthErrorMessage(err);
      setLoginError(ptMsg);
      throw new Error(ptMsg);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setLoginError(null);
    if (!isSupabaseConfigured) {
      setLoginError('O Supabase ainda não está configurado.');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
    } catch (err: any) {
      const ptMsg = getSupabaseAuthErrorMessage(err);
      setLoginError(ptMsg);
      throw new Error(ptMsg);
    }
  };

  const sendVerificationEmail = async () => {
    if (!user?.email) {
      throw new Error('Nenhum usuário ativo para enviar e-mail de verificação.');
    }
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
      if (error) throw error;
    } catch (err: any) {
      const ptMsg = getSupabaseAuthErrorMessage(err);
      throw new Error(ptMsg);
    }
  };

  const reloadUser = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return false;
      const verified = Boolean(data.user.email_confirmed_at);
      setIsEmailVerified(verified);
      setUser(data.user);
      return verified;
    } catch (err: any) {
      console.error('Erro ao recarregar status do usuário:', err);
      return false;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      StorageService.setActiveUser(null);
      setUser(null);
      setProfile(null);
      setIsEmailVerified(false);
    } catch (err: any) {
      console.error('Erro ao encerrar sessão:', err);
    }
  };

  const clearError = () => setLoginError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginError,
        isConfigured: isSupabaseConfigured,
        isEmailVerified,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendPasswordReset,
        sendVerificationEmail,
        reloadUser,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
