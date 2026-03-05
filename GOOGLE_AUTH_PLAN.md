# Plano de Implementação: Login com Google + Account Linking

## Visão Geral

Implementar autenticação Google Sign-In com Firebase, incluindo vinculação de contas, suporte a múltiplos provedores e gestão de credenciais.

---

## 📋 Fase 1: Análise e Preparação

### 1.1 Dependências Necessárias

```bash
# Expo Google Sign-In (compatível com Expo SDK 54)
npx expo install @react-native-google-signin/google-signin

# Ou usar Expo AuthSession (alternativa mais integrada ao Expo)
npx expo install expo-auth-session expo-crypto
```

**Recomendação**: Usar `expo-auth-session` por ser mais integrado ao Expo e não exigir configuração nativa manual.

### 1.2 Configuração Firebase Console

1. Acessar Firebase Console → Authentication → Sign-in method
2. Habilitar **Google** como provedor
3. Registrar **iOS OAuth Client ID** e **Android OAuth Client ID**
4. Configurar **SHA-1/SHA-256** fingerprints para Android
5. Baixar `google-services.json` (Android) e `GoogleService-Info.plist` (iOS) atualizados

### 1.3 Configuração no Google Cloud Console

1. Criar **OAuth 2.0 Client IDs** para:
   - Android (com SHA-1 do keystore)
   - iOS (com Bundle ID)
   - Web (para Expo Go durante desenvolvimento)

---

## 📋 Fase 2: Configuração Nativa

### 2.1 Configurar `app.config.ts`

```typescript
// app.config.ts - Adicionar
export default ({ config }: ConfigContext): AppConfig => ({
  // ... configurações existentes
  
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.pedrorbc.HomeCare",
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || "./GoogleService-Info.plist",
    
    // Adicionar URL schemes para Google Sign-In
    infoPlist: {
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [
            "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID" // Reversed client ID
          ]
        }
      ]
    }
  },
  
  android: {
    adaptiveIcon: { /* ... */ },
    package: "com.pedrorbc.HomeCare",
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
    
    // Configuração para Google Sign-In já está no google-services.json
  },
  
  extra: {
    eas: {
      projectId: "seu-project-id"
    },
    // Adicionar client IDs para AuthSession
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
    googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID || "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
    googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
  }
});
```

### 2.2 Variáveis de Ambiente (`.env`)

```env
# .env
GOOGLE_WEB_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=123456789-ios.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=123456789-android.apps.googleusercontent.com
```

---

## 📋 Fase 3: Tipos e Schemas

### 3.1 Atualizar `AuthContext.tsx` - Tipos

```typescript
// src/context/AuthContext.tsx

export type AuthProvider = 'password' | 'google.com';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  providers: AuthProvider[]; // Lista de provedores vinculados
  hasPassword: boolean; // Se tem senha configurada
}

interface AuthContextType {
  // ... existentes
  user: User | null;
  loading: boolean;
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  
  // Account management
  linkWithPassword: (email: string, password: string) => Promise<void>;
  linkWithGoogle: () => Promise<void>;
  unlinkProvider: (providerId: AuthProvider) => Promise<void>;
  
  // Password management
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setPasswordForGoogleAccount: (password: string) => Promise<void>;
  
  // Profile
  updateProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
}
```

### 3.2 Atualizar Firestore Schema

```typescript
// src/services/firestore.ts - Adicionar ao UserProfile

interface FirestoreUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
  
  // Novos campos
  providers: AuthProvider[]; // ['password', 'google.com']
  hasPassword: boolean;
  googleId?: string; // ID do Google (sub claim)
}
```

---

## 📋 Fase 4: Implementação Core - Google Sign-In

### 4.1 Utilitário Google Auth (`src/utils/googleAuth.ts`)

```typescript
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider } from '@react-native-firebase/auth';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthResult {
  idToken: string;
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    picture: string;
  };
}

export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
    androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId,
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
    scopes: ['profile', 'email'],
  });

  return { request, response, promptAsync };
};

// Helper para criar Firebase credential do Google
export const createGoogleCredential = (idToken: string) => {
  return GoogleAuthProvider.credential(idToken);
};

// Extrair user info do ID token (decodificar JWT)
export const decodeGoogleIdToken = (idToken: string) => {
  try {
    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding ID token:', error);
    return null;
  }
};
```

### 4.2 Atualizar `AuthContext.tsx` - Google Sign-In

```typescript
// src/context/AuthContext.tsx

import { 
  getAuth, 
  signInWithCredential,
  linkWithCredential,
  unlink,
  GoogleAuthProvider,
  EmailAuthProvider,
  updatePassword as firebaseUpdatePassword,
  // ... outros imports
} from '@react-native-firebase/auth';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // ... states existentes
  
  // Helper para extrair providers do usuário
  const getUserProviders = (firebaseUser: FirebaseAuthTypes.User): AuthProvider[] => {
    return firebaseUser.providerData.map(p => p.providerId as AuthProvider);
  };
  
  // Helper para verificar se tem senha
  const checkHasPassword = (providers: AuthProvider[]): boolean => {
    return providers.includes('password');
  };

  // Atualizar onAuthStateChanged para incluir providers
  useEffect(() => {
    const authInstance = getAuth();
    const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
      if (firebaseUser) {
        const providers = getUserProviders(firebaseUser);
        const hasPassword = checkHasPassword(providers);
        
        try {
          const firestoreUser = await FirestoreService.getUserProfile(firebaseUser.uid);
          
          const userData: User = {
            uid: firebaseUser.uid,
            email: firestoreUser?.email || firebaseUser.email,
            displayName: firestoreUser?.displayName || firebaseUser.displayName,
            photoURL: firestoreUser?.photoURL || firebaseUser.photoURL,
            providers,
            hasPassword,
          };
          
          setUser(userData);
          
          // Atualizar Firestore se necessário
          if (firestoreUser) {
            if (
              firestoreUser.providers !== providers ||
              firestoreUser.hasPassword !== hasPassword
            ) {
              await FirestoreService.updateUserProviders(firebaseUser.uid, {
                providers,
                hasPassword,
              });
            }
          }
        } catch (error) {
          console.error('Error loading user:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);

  // ✅ 1. Sign in with Google (novo usuário ou existente)
  const signInWithGoogle = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Usar hook do expo-auth-session (implementar no componente)
      // Por agora, placeholder para a lógica
      const { idToken, user: googleUser } = await performGoogleSignIn();
      
      const credential = GoogleAuthProvider.credential(idToken);
      const authInstance = getAuth();
      
      try {
        // Tentar sign in com Google
        const result = await signInWithCredential(authInstance, credential);
        
        // Se é novo usuário, criar perfil no Firestore
        if (result.additionalUserInfo?.isNewUser) {
          await FirestoreService.createUserProfile(
            result.user.uid,
            result.user.email || googleUser.email,
            result.user.displayName || googleUser.name,
            result.user.photoURL || googleUser.picture
          );
          setIsNewUser(true);
        }
        
        AnalyticsService.trackEvent('login_success', {
          method: 'google',
          is_new_user: result.additionalUserInfo?.isNewUser,
        });
      } catch (error: any) {
        // Se conta existe com email/senha, oferecer linking
        if (error.code === 'auth/account-exists-with-different-credential') {
          throw new Error('ACCOUNT_EXISTS_LINK_REQUIRED');
        }
        throw error;
      }
    } catch (error: any) {
      AnalyticsService.trackEvent('login_failed', {
        method: 'google',
        error_code: error.code,
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ✅ 2. Vincular Google a conta existente (usuário já logado com email/senha)
  const linkWithGoogle = async (): Promise<void> => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    
    if (!currentUser) {
      throw new Error('No user logged in');
    }
    
    try {
      const { idToken } = await performGoogleSignIn();
      const credential = GoogleAuthProvider.credential(idToken);
      
      await linkWithCredential(currentUser, credential);
      
      AnalyticsService.trackEvent('account_linked', {
        provider: 'google',
      });
    } catch (error: any) {
      if (error.code === 'auth/credential-already-in-use') {
        throw new Error('Esta conta Google já está vinculada a outro usuário');
      }
      throw error;
    }
  };

  // ✅ 3. Vincular email/senha a conta Google existente
  const linkWithPassword = async (email: string, password: string): Promise<void> => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    
    if (!currentUser) {
      throw new Error('No user logged in');
    }
    
    try {
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(currentUser, credential);
      
      AnalyticsService.trackEvent('account_linked', {
        provider: 'password',
      });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Este email já está em uso');
      }
      throw error;
    }
  };

  // ✅ 4. Definir senha para conta Google (sem senha ainda)
  const setPasswordForGoogleAccount = async (password: string): Promise<void> => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    
    if (!currentUser || !currentUser.email) {
      throw new Error('No user or email available');
    }
    
    // Usar o email existente
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    
    try {
      await linkWithCredential(currentUser, credential);
      
      AnalyticsService.trackEvent('password_set', {
        method: 'google_account',
      });
    } catch (error) {
      throw error;
    }
  };

  // ✅ 5. Desvincular provedor
  const unlinkProvider = async (providerId: AuthProvider): Promise<void> => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    
    if (!currentUser) {
      throw new Error('No user logged in');
    }
    
    // Verificar se tem pelo menos 2 provedores (não pode desvincular o único)
    if (currentUser.providerData.length <= 1) {
      throw new Error('Não é possível desvincular o único método de login');
    }
    
    await unlink(currentUser, providerId);
    
    AnalyticsService.trackEvent('account_unlinked', {
      provider: providerId,
    });
  };

  // ✅ 6. Atualizar senha (para quem já tem senha)
  const updatePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    
    if (!currentUser || !currentUser.email) {
      throw new Error('No user available');
    }
    
    // Reautenticar antes de atualizar senha
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    
    // Atualizar senha
    await firebaseUpdatePassword(currentUser, newPassword);
    
    AnalyticsService.trackEvent('password_updated', {});
  };

  // Helper para Google Sign-In (será implementado no hook)
  const performGoogleSignIn = async (): Promise<{ idToken: string; user: any }> => {
    // Implementação será feita com useGoogleAuth no componente
    // Aqui apenas placeholder
    throw new Error('Not implemented - use hook in component');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isNewUser,
        setIsNewUser,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        linkWithPassword,
        linkWithGoogle,
        unlinkProvider,
        resetPassword,
        updatePassword,
        setPasswordForGoogleAccount,
        updateProfile,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
```

---

## 📋 Fase 5: UI Components

### 5.1 Botão Google Sign-In (`src/components/GoogleSignInButton.tsx`)

```typescript
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string, userData: any) => void;
  onError: (error: Error) => void;
  mode?: 'signin' | 'link';
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  mode = 'signin',
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
    androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId,
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.idToken) {
        // Decodificar user info do ID token
        try {
          const userInfo = decodeIdToken(authentication.idToken);
          onSuccess(authentication.idToken, userInfo);
        } catch (error) {
          onError(error as Error);
        }
      }
      setIsLoading(false);
    } else if (response?.type === 'error') {
      onError(new Error('Google Sign-In cancelado ou erro'));
      setIsLoading(false);
    }
  }, [response]);

  const handlePress = async () => {
    if (!request || disabled) return;
    setIsLoading(true);
    await promptAsync();
  };

  const decodeIdToken = (idToken: string) => {
    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  };

  const buttonText = mode === 'link' 
    ? 'Vincular conta Google' 
    : 'Continuar com Google';

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!request || disabled || isLoading}
      className={`bg-white rounded-lg border border-zinc-300 flex-row items-center justify-center py-4 px-6 ${
        (!request || disabled || isLoading) ? 'opacity-50' : ''
      }`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#000" />
      ) : (
        <>
          <GoogleIcon />
          <Text className="text-zinc-800 font-semibold text-base ml-3">
            {buttonText}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// Google "G" Icon (SVG simplificado)
const GoogleIcon = () => (
  <View className="w-6 h-6 items-center justify-center">
    <Ionicons name="logo-google" size={24} color="#000" />
  </View>
);
```

### 5.2 Atualizar LoginScreen

```typescript
// src/screens/auth/LoginScreen.tsx

import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { GoogleAuthProvider } from '@react-native-firebase/auth';
import { getAuth, signInWithCredential } from '@react-native-firebase/auth';

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  // ... código existente
  
  const handleGoogleSignIn = async (idToken: string, userData: any) => {
    try {
      setIsLoading(true);
      const credential = GoogleAuthProvider.credential(idToken);
      const authInstance = getAuth();
      
      const result = await signInWithCredential(authInstance, credential);
      
      // Se é novo usuário, criar perfil
      if (result.additionalUserInfo?.isNewUser) {
        await FirestoreService.createUserProfile(
          result.user.uid,
          userData.email,
          userData.name,
          userData.picture
        );
      }
      
      // Navegação automática via AuthContext
    } catch (error: any) {
      let errorMessage = 'Erro ao fazer login com Google';
      
      if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'Uma conta com este email já existe. Por favor, faça login com email/senha e vincule sua conta Google nas configurações.';
      }
      
      showAlert({
        title: 'Erro',
        message: errorMessage,
        icon: 'alert-circle',
        iconColor: '#ef4444',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = (error: Error) => {
    showAlert({
      title: 'Erro',
      message: 'Não foi possível conectar com Google',
      icon: 'alert-circle',
      iconColor: '#ef4444',
      buttons: [{ text: 'OK', style: 'default' }],
    });
  };

  return (
    <View className="flex-1 bg-zinc-900" style={{ paddingTop: topInset, paddingBottom: bottomInset }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 py-8 justify-center">
          {/* Header (existente) */}
          
          {/* Form Email/Senha (existente) */}
          
          {/* Divisor */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-zinc-700" />
            <Text className="text-zinc-500 px-4 text-sm">ou</Text>
            <View className="flex-1 h-px bg-zinc-700" />
          </View>
          
          {/* Botão Google */}
          <GoogleSignInButton
            onSuccess={handleGoogleSignIn}
            onError={handleGoogleError}
            disabled={isLoading}
          />
          
          {/* Footer (existente) */}
        </View>
      </ScrollView>
    </View>
  );
};
```

---

## 📋 Fase 6: Account Management UI

### 6.1 Tela de Gerenciamento de Conta (`src/screens/profile/AccountManagementScreen.tsx`)

```typescript
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Card } from '@/components/Card';

export const AccountManagementScreen = () => {
  const { user, linkWithGoogle, unlinkProvider, setPasswordForGoogleAccount, updatePassword } = useAuth();
  const { showAlert } = useAlert();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const hasGoogle = user?.providers.includes('google.com');
  const hasPassword = user?.hasPassword;

  // Vincular Google
  const handleLinkGoogle = async (idToken: string) => {
    try {
      await linkWithGoogle();
      showAlert({
        title: 'Sucesso',
        message: 'Conta Google vinculada com sucesso!',
        icon: 'checkmark-circle',
        iconColor: '#10b981',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } catch (error: any) {
      showAlert({
        title: 'Erro',
        message: error.message || 'Erro ao vincular conta Google',
        icon: 'alert-circle',
        iconColor: '#ef4444',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  };

  // Desvincular Google
  const handleUnlinkGoogle = () => {
    showAlert({
      title: 'Desvincular Google',
      message: 'Tem certeza que deseja desvincular sua conta Google?',
      icon: 'unlink',
      iconColor: '#f59e0b',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            try {
              await unlinkProvider('google.com');
              showAlert({
                title: 'Sucesso',
                message: 'Conta Google desvinculada',
                icon: 'checkmark-circle',
                iconColor: '#10b981',
                buttons: [{ text: 'OK', style: 'default' }],
              });
            } catch (error: any) {
              showAlert({
                title: 'Erro',
                message: error.message,
                icon: 'alert-circle',
                iconColor: '#ef4444',
                buttons: [{ text: 'OK', style: 'default' }],
              });
            }
          },
        },
      ],
    });
  };

  // Definir senha
  const handleSetPassword = async () => {
    if (password.length < 6) {
      showAlert({
        title: 'Erro',
        message: 'A senha deve ter pelo menos 6 caracteres',
        icon: 'alert-circle',
        iconColor: '#ef4444',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (password !== confirmPassword) {
      showAlert({
        title: 'Erro',
        message: 'As senhas não coincidem',
        icon: 'alert-circle',
        iconColor: '#ef4444',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    try {
      await setPasswordForGoogleAccount(password);
      setShowPasswordForm(false);
      setPassword('');
      setConfirmPassword('');
      showAlert({
        title: 'Sucesso',
        message: 'Senha configurada com sucesso! Agora você pode fazer login com email e senha.',
        icon: 'checkmark-circle',
        iconColor: '#10b981',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } catch (error: any) {
      showAlert({
        title: 'Erro',
        message: error.message || 'Erro ao configurar senha',
        icon: 'alert-circle',
        iconColor: '#ef4444',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  };

  return (
    <ScrollView className="flex-1 bg-zinc-900 px-6 py-8">
      <Text className="text-2xl font-bold text-white mb-2">Gerenciar Conta</Text>
      <Text className="text-zinc-400 mb-6">Métodos de login e segurança</Text>

      {/* Métodos de Login */}
      <Card variant="elevated" className="mb-4">
        <Text className="text-white font-semibold mb-4">Métodos de Login</Text>

        {/* Email/Senha */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-emerald-600/20 rounded-full items-center justify-center mr-3">
              <Ionicons name="mail" size={20} color="#10b981" />
            </View>
            <View>
              <Text className="text-white">Email e Senha</Text>
              <Text className="text-xs text-zinc-400">{user?.email}</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            {hasPassword ? (
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            ) : (
              <TouchableOpacity
                onPress={() => setShowPasswordForm(true)}
                className="bg-emerald-600 rounded-lg px-3 py-2"
              >
                <Text className="text-white text-xs">Configurar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Google */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-blue-600/20 rounded-full items-center justify-center mr-3">
              <Ionicons name="logo-google" size={20} color="#3b82f6" />
            </View>
            <View>
              <Text className="text-white">Google</Text>
              <Text className="text-xs text-zinc-400">
                {hasGoogle ? 'Vinculado' : 'Não vinculado'}
              </Text>
            </View>
          </View>
          {hasGoogle ? (
            <TouchableOpacity
              onPress={handleUnlinkGoogle}
              className="bg-red-600 rounded-lg px-3 py-2"
              disabled={user?.providers.length === 1}
            >
              <Text className="text-white text-xs">Desvincular</Text>
            </TouchableOpacity>
          ) : (
            <View className="w-32">
              <GoogleSignInButton
                mode="link"
                onSuccess={handleLinkGoogle}
                onError={(error) => {
                  showAlert({
                    title: 'Erro',
                    message: 'Erro ao vincular Google',
                    icon: 'alert-circle',
                    iconColor: '#ef4444',
                    buttons: [{ text: 'OK', style: 'default' }],
                  });
                }}
              />
            </View>
          )}
        </View>
      </Card>

      {/* Form para configurar senha */}
      {showPasswordForm && !hasPassword && (
        <Card variant="elevated" className="mb-4">
          <Text className="text-white font-semibold mb-4">Configurar Senha</Text>
          <Text className="text-zinc-400 text-sm mb-4">
            Configure uma senha para poder fazer login sem depender do Google
          </Text>

          <TextInput
            className="bg-zinc-800 text-white rounded-lg px-4 py-3 mb-3"
            placeholder="Nova senha"
            placeholderTextColor="#71717a"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TextInput
            className="bg-zinc-800 text-white rounded-lg px-4 py-3 mb-4"
            placeholder="Confirmar senha"
            placeholderTextColor="#71717a"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setShowPasswordForm(false)}
              className="flex-1 bg-zinc-700 rounded-lg py-3 items-center"
            >
              <Text className="text-white">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSetPassword}
              className="flex-1 bg-emerald-600 rounded-lg py-3 items-center"
            >
              <Text className="text-white font-semibold">Confirmar</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Informações */}
      <Card variant="outlined" className="bg-blue-900/20 border-blue-700">
        <View className="flex-row">
          <Ionicons name="information-circle" size={20} color="#3b82f6" className="mr-2" />
          <View className="flex-1 ml-2">
            <Text className="text-blue-400 text-sm">
              Recomendamos vincular múltiplos métodos de login para garantir acesso à sua conta.
            </Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
};
```

---

## 📋 Fase 7: Fluxos de Uso

### 7.1 Cenário 1: Novo Usuário - Login com Google

```
1. Usuário clica em "Continuar com Google"
2. Popup Google Sign-In
3. Usuário escolhe conta
4. Firebase cria conta automaticamente
5. Firestore: criar perfil com providers: ['google.com'], hasPassword: false
6. Redirecionar para onboarding ou app principal
```

### 7.2 Cenário 2: Usuário Existente (Email/Senha) - Vincular Google

```
1. Usuário logado com email/senha
2. Vai em Perfil → Gerenciar Conta
3. Clica em "Vincular Google"
4. Popup Google Sign-In
5. Firebase: linkWithCredential()
6. Firestore: atualizar providers: ['password', 'google.com']
7. Mostrar sucesso
```

### 7.3 Cenário 3: Usuário com Google - Adicionar Senha

```
1. Usuário logado com Google (sem senha)
2. Vai em Perfil → Gerenciar Conta
3. Vê "Email e Senha" com botão "Configurar"
4. Clica → Form aparece
5. Digita senha + confirmar
6. Firebase: linkWithCredential(email, senha)
7. Firestore: atualizar hasPassword: true, providers: ['google.com', 'password']
8. Agora pode fazer login com ambos
```

### 7.4 Cenário 4: Conflito de Email (Google × Email/Senha)

```
1. Usuário tenta login com Google
2. Email já existe com método email/senha
3. Firebase retorna: auth/account-exists-with-different-credential
4. Mostrar mensagem: "Conta existe. Faça login com email/senha e vincule Google nas configurações"
5. Usuário faz login com email/senha
6. Vai em Gerenciar Conta → Vincular Google
7. Vincula com sucesso
```

---

## 📋 Fase 8: Testes e Validação

### 8.1 Checklist de Testes

- [ ] **Login com Google** (novo usuário)
- [ ] **Login com Google** (usuário existente)
- [ ] **Vincular Google** a conta email/senha
- [ ] **Vincular senha** a conta Google
- [ ] **Desvincular Google** (manter senha)
- [ ] **Desvincular senha** (manter Google)
- [ ] **Tentar desvincular único método** (deve bloquear)
- [ ] **Conflito de email** (Google × Email/Senha)
- [ ] **Logout e re-login** com ambos métodos
- [ ] **Foto de perfil** do Google sincronizada
- [ ] **Firestore** atualizado com providers corretos
- [ ] **Analytics** trackando eventos corretamente

### 8.2 Comandos para Testar

```bash
# Limpar cache e rebuild
npx expo start -c

# Build de dev (iOS)
eas build --profile development --platform ios

# Build de dev (Android)
eas build --profile development --platform android

# Preview build
eas build --profile preview --platform all
```

---

## 📋 Fase 9: Segurança e Edge Cases

### 9.1 Segurança

1. **Nunca expor Client Secret** no código
2. **Validar tokens** no backend quando possível
3. **Rate limiting** para tentativas de login
4. **Reautenticação** antes de operações sensíveis (desvincular, deletar)
5. **Logs de auditoria** no Firestore (opcional)

### 9.2 Edge Cases

1. **Token expirado**: Firebase renova automaticamente
2. **Sem internet**: Mostrar erro amigável
3. **Cancelar Google Sign-In**: Tratar gracefully
4. **Conta desabilitada**: Mostrar mensagem específica
5. **Email não verificado**: Firebase permite, mas pode adicionar verificação

---

## 📋 Resumo de Arquivos a Criar/Modificar

### Novos Arquivos
- [ ] `src/utils/googleAuth.ts` - Utilitários Google
- [ ] `src/components/GoogleSignInButton.tsx` - Botão reutilizável
- [ ] `src/screens/profile/AccountManagementScreen.tsx` - Gerenciar métodos

### Arquivos a Modificar
- [ ] `src/context/AuthContext.tsx` - Adicionar métodos Google + linking
- [ ] `src/services/firestore.ts` - Schema com providers
- [ ] `src/screens/auth/LoginScreen.tsx` - Adicionar botão Google
- [ ] `src/screens/auth/RegisterScreen.tsx` - Adicionar botão Google (opcional)
- [ ] `app.config.ts` - Client IDs e URL schemes
- [ ] `.env` - Client IDs seguros

---

## 🎯 Ordem de Implementação Recomendada

1. **Fase 1-2**: Configuração (Firebase Console, app.config, .env)
2. **Fase 3**: Tipos e schemas (AuthContext types, Firestore)
3. **Fase 4**: Core - Google Sign-In básico (AuthContext + utils)
4. **Fase 5**: UI - Botão e integração na LoginScreen
5. **Fase 6**: Account Linking - UI de gerenciamento
6. **Fase 7**: Testar todos os fluxos
7. **Fase 8**: Polimento e edge cases

---

## 📝 Notas Importantes

- **Expo AuthSession** é mais fácil que `@react-native-google-signin` para Expo managed
- **Firebase Auth** já gerencia sessão e refresh tokens automaticamente
- **Linking** só funciona se emails coincidirem
- **Testar primeiro em Development Client**, depois em builds standalone
- **iOS**: Pode precisar de ajustes no Info.plist (Expo cuida disso)
- **Android**: SHA-1/SHA-256 são críticos (gerar do keystore)

---

Este plano está pronto para implementação! 🚀
