import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, googleProvider, db, isFirebaseConfigured } from '../services/firebase';
import { UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { getFirebaseAuthErrorMessage } from '../utils/authErrors';

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

  // Sincroniza o usuário no Firestore e no StorageService
  const syncUserProfile = useCallback(async (firebaseUser: User) => {
    // Define imediatamente o namespace no StorageService para o usuário ativo
    StorageService.setActiveUser(firebaseUser.uid);
    setUser(firebaseUser);
    setIsEmailVerified(firebaseUser.emailVerified);

    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(userDocRef);

      if (!docSnap.exists()) {
        // Novo usuário: OBRIGATORIAMENTE role 'student' e plan 'free', com os 8 campos exigidos pelas regras
        const newProfileData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || null,
          displayName: firebaseUser.displayName || 'Estudante SynapseMed',
          photoURL: firebaseUser.photoURL || null,
          role: 'student' as const,
          plan: 'free' as const,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };

        await setDoc(userDocRef, newProfileData);

        setProfile({
          uid: firebaseUser.uid,
          email: firebaseUser.email || null,
          displayName: firebaseUser.displayName || 'Estudante SynapseMed',
          photoURL: firebaseUser.photoURL || null,
          role: 'student',
          plan: 'free',
        });
      } else {
        const data = docSnap.data();

        // Atualização segura: apenas displayName, photoURL e lastLoginAt são atualizados
        try {
          await updateDoc(userDocRef, {
            displayName: firebaseUser.displayName || data.displayName || 'Estudante SynapseMed',
            photoURL: firebaseUser.photoURL || data.photoURL || null,
            lastLoginAt: serverTimestamp(),
          });
        } catch (updateErr) {
          console.warn('Não foi possível atualizar lastLoginAt (esperado se offline):', updateErr);
        }

        setProfile({
          uid: firebaseUser.uid,
          email: data.email || firebaseUser.email || null,
          displayName: firebaseUser.displayName || data.displayName || 'Estudante SynapseMed',
          photoURL: firebaseUser.photoURL || data.photoURL || null,
          role: data.role === 'admin' ? 'admin' : 'student',
          plan: data.plan === 'premium' ? 'premium' : 'free',
          createdAt: data.createdAt,
          lastLoginAt: data.lastLoginAt,
        });
      }
    } catch (err: any) {
      console.error('Erro ao sincronizar perfil do Firestore:', err);
      // Cria perfil em memória para não bloquear o funcionamento básico
      setProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || 'Estudante SynapseMed',
        photoURL: firebaseUser.photoURL || null,
        role: 'student',
        plan: 'free',
      });
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          await syncUserProfile(firebaseUser);
        } else {
          StorageService.setActiveUser(null);
          setUser(null);
          setProfile(null);
          setIsEmailVerified(false);
        }
      } catch (err: any) {
        console.error('Erro ao processar alteração de autenticação:', err);
        setLoginError(getFirebaseAuthErrorMessage(err));
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [syncUserProfile]);

  const loginWithGoogle = async () => {
    setLoginError(null);
    if (!isFirebaseConfigured) {
      setLoginError(
        'As variáveis do Firebase Web ainda não foram configuradas no ambiente. Configure VITE_FIREBASE_API_KEY e VITE_FIREBASE_PROJECT_ID no arquivo .env.'
      );
      return;
    }

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        await syncUserProfile(cred.user);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // Usuário fechou o popup intencionalmente
        return;
      }
      console.error('Falha na autenticação com o Google:', err);
      setLoginError(getFirebaseAuthErrorMessage(err));
      throw err;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setLoginError(null);
    if (!isFirebaseConfigured) {
      setLoginError(
        'O Firebase ainda não está configurado. Verifique as credenciais no arquivo .env.'
      );
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user) {
        await syncUserProfile(cred.user);
      }
    } catch (err: any) {
      const ptMsg = getFirebaseAuthErrorMessage(err);
      setLoginError(ptMsg);
      throw new Error(ptMsg);
    }
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    setLoginError(null);
    if (!isFirebaseConfigured) {
      setLoginError(
        'O Firebase ainda não está configurado. Verifique as credenciais no arquivo .env.'
      );
      return;
    }

    try {
      // 1. Criar conta no Firebase Authentication
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newUser = cred.user;

      // 2. Atualizar o nome de exibição no perfil do Firebase Auth
      await updateProfile(newUser, {
        displayName: name.trim(),
      });

      // 3. Enviar e-mail de verificação para o usuário
      await sendEmailVerification(newUser);

      // 4. Criar documento users/{uid} no Firestore com role: 'student' e plan: 'free'
      const userDocRef = doc(db, 'users', newUser.uid);
      const newProfileData = {
        uid: newUser.uid,
        email: newUser.email || null,
        displayName: name.trim(),
        photoURL: null,
        role: 'student' as const,
        plan: 'free' as const,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };

      try {
        await setDoc(userDocRef, newProfileData);
      } catch (firestoreErr) {
        console.warn('Aviso: perfil criado no Auth, salvando documento Firestore:', firestoreErr);
      }

      // Sincronizar estado local
      StorageService.setActiveUser(newUser.uid);
      setUser(newUser);
      setIsEmailVerified(false); // E-mail ainda precisa ser verificado
      setProfile({
        uid: newUser.uid,
        email: newUser.email || null,
        displayName: name.trim(),
        photoURL: null,
        role: 'student',
        plan: 'free',
      });
    } catch (err: any) {
      const ptMsg = getFirebaseAuthErrorMessage(err);
      setLoginError(ptMsg);
      throw new Error(ptMsg);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setLoginError(null);
    if (!isFirebaseConfigured) {
      setLoginError('O Firebase ainda não está configurado.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const ptMsg = getFirebaseAuthErrorMessage(err);
      setLoginError(ptMsg);
      throw new Error(ptMsg);
    }
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('Nenhum usuário ativo para enviar e-mail de verificação.');
    }
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err: any) {
      const ptMsg = getFirebaseAuthErrorMessage(err);
      throw new Error(ptMsg);
    }
  };

  const reloadUser = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    try {
      await auth.currentUser.reload();
      const current = auth.currentUser;
      const verified = current.emailVerified;
      setIsEmailVerified(verified);
      setUser(current);
      return verified;
    } catch (err: any) {
      console.error('Erro ao recarregar status do usuário:', err);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
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
        isConfigured: isFirebaseConfigured,
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
