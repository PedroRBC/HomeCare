# 📱 Google Auth - Visual Quick Reference

## 🎨 Fluxo Visual de Telas

### Fluxo 1: Novo Usuário com Google

```
┌─────────────────────┐
│   LoginScreen       │
│  ┌───────────────┐  │
│  │ Email [___]   │  │
│  │ Senha [___]   │  │
│  │ [Login]       │  │  ← Entrada clássica
│  └───────────────┘  │
│        ou           │
│  ┌───────────────┐  │
│  │  [Google]     │  │  ← NOVO - click aqui
│  └───────────────┘  │
│  [Register]         │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ Google Auth Dialog  │
│  Selecione conta    │
│  Confirme perms     │
└─────────────────────┘
         ↓
┌─────────────────────┐
│   HomeScreen        │  ✅ Novo usuário criado
│  (já logado)        │     email=seu@gmail.com
│  ----------         │     name=Seu Nome (Google)
│  Calendário setup   │     providers=['google.com']
└─────────────────────┘
```

---

### Fluxo 2: Vincular Google Existente

```
┌─────────────────────────────┐
│  UserProfileScreen         │
│  ┌─────────────────────┐   │
│  │ Meu Perfil          │   │
│  │ ----------          │   │
│  │ Nome: [Seu Nome]    │   │
│  │ Email: abc@gmail    │   │
│  │                     │   │
│  │ [Gerenciar Conta]   │   │ ← NOVO BOTÃO
│  │ [Salvar]            │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│ AccountManagementScreen    │  ← NOVA TELA
│ ┌───────────────────────┐  │
│ │ Email e Senha         │  │
│ │ ✅ abc@gmail.com      │  │
│ │                       │  │
│ │ [Alterar Senha]       │  │
│ ├───────────────────────┤  │
│ │ Google                │  │
│ │ ⭕ Não vinculado      │  │
│ │                       │  │
│ │ [Vincular]            │  │ ← Click aqui
│ └───────────────────────┘  │
└─────────────────────────────┘
         ↓
┌─────────────────────┐
│ Google OAuth        │
│ Selecione conta     │
│ abc@gmail.com ✅    │
│ (mesmo email)       │
└─────────────────────┘
         ↓
┌─────────────────────────────┐
│ AccountManagementScreen    │
│ ┌───────────────────────┐  │
│ │ Email e Senha         │  │
│ │ ✅ abc@gmail.com      │  │
│ │                       │  │
│ │ Google                │  │
│ │ ✅ Vinculado!         │  │  ✅ Sucesso!
│ │                       │  │  Agora: 2 métodos
│ │ [Desvincular]         │  │
│ └───────────────────────┘  │
└─────────────────────────────┘
```

---

### Fluxo 3: Configurar Senha em Conta Google

```
┌─────────────────────────────┐
│ AccountManagementScreen    │
│ ┌───────────────────────┐  │
│ │ Email e Senha         │  │
│ │📧 abc@gmail.com       │  │
│ │                       │  │
│ │ ⭕ Não configurado     │  │
│ │ [Configurar Senha]    │  │ ← Click
│ ├───────────────────────┤  │
│ │ Google                │  │
│ │ ✅ Vinculado          │  │
│ └───────────────────────┘  │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│ Modal: Configurar Senha    │
│ ┌───────────────────────┐  │
│ │ Nova Senha [____]     │  │
│ │ Confirmar  [____]     │  │
│ │                       │  │
│ │ [Cancelar] [Confirmar]│  │
│ └───────────────────────┘  │
└─────────────────────────────┘
         ↓
✅ Pronto! Agora pode:
   - Login: email + senha
   - Login: Google
   - Alterar senha
```

---

## 🗺️ Navegação Completa

```
Authentication Flows:
│
├─ [LoginScreen]
│  ├─ Email + Senha → AuthContext.signInWithEmail()
│  └─ [Google Button] → GoogleSignInButton → AuthContext.signInWithGoogle()
│
└─ [HouseManagement / CareManagement]
   │
   ├─ [UserProfileScreen]
   │  └─ [Gerenciar Conta Button]
   │     └─ [AccountManagementScreen] ← NEW
   │        ├─ Vincular Google
   │        ├─ Configurar Senha
   │        ├─ Alterar Senha
   │        └─ Desvincular Método
   │
   └─ ... (resto do app)
```

---

## 🔑 Componentes-Chave

### GoogleSignInButton
```typescript
<GoogleSignInButton
  mode="signin"              // ou "link"
  onSuccess={handleSuccess}
  onError={handleError}
  disabled={isLoading}
/>
```

### AccountManagementScreen
```typescript
Navigation.navigate('AccountManagement')
```
Mostra:
- Email atual + status (configurado/não)
- Google + status (vinculado/não)
- Botões de ação (vincular, desvincular, alterar, configurar)
- Modais de formulário para senha

---

## ⚡ Estados de Usuário

### Estado 1: Novo (Email + Senha)
```
User {
  email: 'abc@gmail.com',
  displayName: 'João',
  providers: ['password'],
  hasPassword: true
}
```
Pode fazer: Login com email/senha
Pode vincular: Google

---

### Estado 2: Novo (Google)
```
User {
  email: 'abc@gmail.com',
  displayName: 'João Silva',  // do Google
  providers: ['google.com'],
  hasPassword: false
}
```
Pode fazer: Login com Google
Pode configurar: Senha
Pode vincular: (já tem Google)

---

### Estado 3: Email + Google (Ideal)
```
User {
  email: 'abc@gmail.com',
  displayName: 'João',
  providers: ['password', 'google.com'],
  hasPassword: true
}
```
Pode fazer:
- ✅ Login email + senha
- ✅ Login Google
- ✅ Alterar senha
- ✅ Desvincular Google (mantém email)
- ✅ Trocar nome/avatar

---

## 🎯 Checklist: O Que Teste Depois do EAS Build

**Teste 1: Novo Usuário (Google)**
- [ ] Abrir app → Login Screen
- [ ] Clicar [Google]
- [ ] Selecionar conta Google
- [ ] Confirmar permissões
- [ ] ✅ App entra logado
- [ ] Ir ao Perfil → Email correto + Nome do Google

**Teste 2: Vincular Google**
- [ ] Login com email/senha
- [ ] Ir a Meu Perfil
- [ ] Clicar [Gerenciar Conta]
- [ ] Na seção Google, clicar [Vincular]
- [ ] ✅ Após, Google mostra ✅
- [ ] Logout → Login com Google funciona?

**Teste 3: Configurar Senha (Google Account)**
- [ ] Login com Google (sem password)
- [ ] Perfil → Gerenciar Conta
- [ ] Clicar [Configurar Senha]
- [ ] Digitar senha 6+ caracteres
- [ ] ✅ Após, email mostra ✅
- [ ] Logout → Login com email + senha funciona?

**Teste 4: Alterar Senha**
- [ ] User com email + Google
- [ ] Perfil → Gerenciar Conta
- [ ] Clicar [Alterar Senha]
- [ ] Digitar senha atual + nova
- [ ] ✅ Success → Nova senha funciona

**Teste 5: Desvincular (com proteção)**
- [ ] User com email + Google
- [ ] Perfil → Gerenciar Conta
- [ ] Clicar [Desvincular Google]
- [ ] Confirma no alert
- [ ] ✅ Google agora ⭕ (não vinculado)
- [ ] Email ainda ✅
- [ ] Login com Google NÃO funciona mais

**Teste 6: Proteção (desvincular único método)**
- [ ] User com APENAS Google
- [ ] Perfil → Gerenciar Conta
- [ ] Botão [Desvincular] está desabilitado/cinza
- [ ] ✅ Não deixa desvinc (único método)

---

## 🐛 Possíveis Problemas

| Problema | Causa | Solução |
|---|---|---|
| Google button não aparece | React/Native module não compilou | `eas build` |
| "Invalid Client ID" | .env não carregou corretamente | Restart app, check .env |
| "SHA-1 mismatch" | SHA-1 não bate | Verifique no Firebase Console |
| "ACCOUNT_EXISTS" | Email já existe em outro método | Faça login com email primeiro |
| Dois usuarios criados | AuthState synced mal | Clear Firestore, re-test |

---

## 🛠️ Debug Commands

```bash
# Ver variáveis de env carregadas
adb logcat | grep GOOGLE_WEB_CLIENT_ID

# Limpar app data (Android)
adb shell pm clear com.pedrorbc.HomeCare

# Ver firebase auth logs
firebase_auth_debug=true npm start
```

---

## 📞 Rápida Referência de Arquivo

| O Que | Onde |
|---|---|
| **Novo**: Tela de Conta | `src/screens/profile/AccountManagementScreen.tsx` |
| **Novo**: Botão Google | `src/components/GoogleSignInButton.tsx` |
| **Modificado**: Auth Context | `src/context/AuthContext.tsx` |
| **Modificado**: Firestore | `src/services/firestore.ts` |
| **Modificado**: Login Screen | `src/screens/auth/LoginScreen.tsx` |
| **Modificado**: User Profile | `src/screens/profile/UserProfileScreen.tsx` |
| **Modificado**: Config App | `app.config.ts` |
| **Modificado**: Tipos | `src/router/types.ts` |
| **Modificado**: Routes | `src/router/main-app.routes.tsx` |

---

## ✨ Status Final

```
✅ Code complete
✅ No compilation errors
✅ Firebase configured
✅ .env set
✅ Documentation ready
⏳ EAS Build next
⏳ Testing after build
🚀 Production ready (after testing)
```

---

**Desenvolva com confiança! Tudo está pronto.** 🎉
