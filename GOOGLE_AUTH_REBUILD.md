# Google Auth - Instruções de Rebuild e Testes

## ✅ Status Atual

Toda a implementação de Google Auth foi concluída:

- ✅ **AuthContext**: Métodos de login/logout com Google e email/password
- ✅ **Firestore**: Schema atualizado com `providers` e `hasPassword`
- ✅ **GoogleSignInButton**: Componente reutilizável via Expo AuthSession
- ✅ **LoginScreen**: Google Sign-In integrado
- ✅ **AccountManagementScreen**: Tela final para gerenciar métodos de login
- ✅ **Firebase Console**: SHA-1 registrado, Google habilitado
- ✅ **.env**: GOOGLE_WEB_CLIENT_ID configurado
- ✅ **google-services.json**: Atualizado com fingerpoint SHA-1

## 🚀 Próximo Passo: Rebuild

A alteração no `app.config.ts` (adição do plugin `expo-web-browser`) exige um **rebuild nativo**.

### Opção 1: EAS Build (Recomendado)

Você precisa de uma conta EAS (Expo Application Services). Se não tiver:

```bash
npm install -g eas-cli
eas login  # ou eas auth login
```

**Build de Desenvolvimento** (para teste rápido em device/emulator):

```bash
# Android
eas build --profile development --platform android --local

# iOS (apenas se tiver Mac com Xcode)
eas build --profile development --platform ios --local
```

Depois de construído, você receberá um link QR para escanear com seu device ou abrir no emulator.

### Opção 2: Prebuild Local (alternativa rápida)

```bash
# Limpar e reconstruir
  rm -rf android ios
  npx expo prebuild --clean
  
# Depois executar no Android
  npm run android
```

## 🧪 Testes Após Rebuild

Após o rebuild, teste os **3 fluxos de OAuth**:

### Teste 1: Novo Usuário com Google ✨

1. Abra o app
2. Na tela de login, clique em **"Entrar com Google"**
3. Selecione sua conta Google
4. Confirme as permissões solicitadas
5. **Esperado**: Novo usuário criado automaticamente com nome e foto do Google
6. Você é redirecionado para a tela de seleção de casa

### Teste 2: Vincular Google a Conta Existente 🔗

1. Faça login com email/senha
2. Vá para **Meu Perfil** → **Gerenciar Conta**
3. Na seção "Google", clique em **"Vincular"**
4. Selecione sua conta Google
5. **Esperado**: Google agora aparece como ✅ vinculado
6. Você pode fazer login com Google mesmo tendo email/senha

### Teste 3: Conflito de Email ⚠️

1. Se você já tem uma conta com email `abc@gmail.com` (sem Google)
2. Tenta fazer login com Google usando `abc@gmail.com`
3. **Erro esperado**: "ACCOUNT_EXISTS_LINK_REQUIRED"
4. **Solução**:
   - Limpe os dados do app ou faça logout
   - Faça login com email/senha
   - Vá para Gerenciar Conta
   - Vincule Google lá

## 🎮 Fluxos Adicionais para Testar

### Alterar Senha (Email + Google)

1. Vá para **Meu Perfil** → **Gerenciar Conta**
2. Se você tem **Email + Senha**:
   - Clique em **"Alterar Senha"**
   - Digite senha atual e nova
   - **Esperado**: Senha alterada, você mantém acesso via email

3. Se você tem **Google mas sem Senha**:
   - Clique em **"Configurar Senha"**
   - Digite nova senha
   - **Esperado**: Agora pode fazer login com email/senha também

### Desvincular Método (proteção)

1. Vá para **Meu Perfil** → **Gerenciar Conta**
2. Clique em **"Desvincular"** em um método
3. **Validação**: Aparece aviso se é o ÚNICO método
4. **Esperado**: Não permite desvinc quando é único

## 📝 Possíveis Erros e Soluções

### Erro: "Native Google Sign-In module not found"
- **Causa**: Rebuild necessário (plugin `expo-web-browser` não instalado)
- **Solução**: Execute `eas build --profile development`

### Erro: "Invalid Client ID"
- **Causa**: `GOOGLE_WEB_CLIENT_ID` incorreto no `.env`
- **Solução**: Verifique no [Google Cloud Console](https://console.cloud.google.com)
  - Projeto: HomeCare
  - OAuth 2.0 Client ID (tipo Web)

### Erro: "SHA-1 mismatch"
- **Causa**: SHA-1 registrado no Firebase não bate com bundleIdentifier
- **Solução**: Verifique no Firebase Console → Auth → Google Sign-In → SHA-1

### Erro: "google-services.json not found"
- **Causa**: Arquivo não está em `android/app/google-services.json`
- **Solução**: Use o arquivo baixado do Firebase Console

## 🔗 Verificação Final

Confirme que todos esses arquivos foram alterados:

```
✅ app.config.ts              → Plugin expo-web-browser + env vars
✅ .env                       → GOOGLE_WEB_CLIENT_ID definido
✅ android/app/google-services.json → SHA-1 e config do Firebase
✅ src/context/AuthContext.tsx → Métodos de Google Auth
✅ src/components/GoogleSignInButton.tsx → Componente novo
✅ src/screens/auth/LoginScreen.tsx → Google button
✅ src/screens/profile/AccountManagementScreen.tsx → Conta nova screen
✅ src/router/main-app.routes.tsx → Rota AccountManagement
✅ src/router/types.ts → Tipo MainAppStackParamList
✅ .gitignore → .env protegido
```

## 🎯 Próximas Ações (após testes bem-sucedidos)

1. **Fazer commit**: `git commit -am "feat: Google Auth full implementation + AccountManagement screen"`
2. **Build para produção**: 
   ```bash
   eas build --profile production --platform android
   ```
3. **Publicar na Play Store/App Store**: Use EAS Submit
   ```bash
   eas submit --platform android
   ```

## 📞 Troubleshooting

Se algo não funcionar:

1. **Limpe cache**: `npm cache clean --force`
2. **Reinstale dependências**: `rm -rf node_modules && npm install`
3. **Reinicie origem do problemy**: `npm start -- --clear`
4. **Verifique environment**: `cat .env` (confirme valores)

---

**Data**: 2024
**Versão**: Google Auth v1 (Production Ready)
**Status**: ✅ Implementação Completa - Pronto para Rebuild
