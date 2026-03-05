# 🔑 Configuração SHA-1 e Google Sign-In no Firebase

## ✅ SHA-1 Gerada com Sucesso

```
SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

---

## 📋 Passo a Passo: Configuração no Firebase Console

### 1️⃣ Adicionar SHA-1 ao Firebase

1. Acesse: **[Firebase Console](https://console.firebase.google.com/)**
2. Selecione o projeto **HomeCare**
3. Clique no ⚙️ **ícone de engrenagem** → **Project Settings** (Configurações do projeto)
4. Role até a seção **Your apps** (Seus aplicativos)
5. Encontre o app Android com package: `com.pedrorbc.HomeCare`
6. Clique para expandir as configurações do app Android
7. Role até **SHA certificate fingerprints**
8. Clique em **Add fingerprint** (Adicionar impressão digital)
9. Cole a SHA-1:
   ```
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```
10. Clique em **Save** (Salvar)

---

### 2️⃣ Habilitar Google Sign-In no Firebase Authentication

1. No Firebase Console, vá em **Authentication** (lateral esquerda)
2. Clique na aba **Sign-in method**
3. Encontre **Google** na lista de provedores
4. Clique em **Google** para expandir
5. Alterne o switch para **Enable** (Habilitar)
6. Configure:
   - **Project public-facing name**: `HomeCare`
   - **Project support email**: Seu email (ex: `seu@email.com`)
7. Clique em **Save** (Salvar)

---

### 3️⃣ Baixar Arquivos de Configuração Atualizados

#### Para Android:

1. Ainda em **Project Settings** → **Your apps**
2. No app Android (`com.pedrorbc.HomeCare`)
3. Clique em **Download google-services.json**
4. **Substitua** o arquivo existente em:
   ```
   HomeCare/android/app/google-services.json
   ```
5. **Também substitua** a cópia na raiz (se existir):
   ```
   HomeCare/google-services.json
   ```

#### Para iOS:

1. No app iOS (`com.pedrorbc.HomeCare`)
2. Clique em **Download GoogleService-Info.plist**
3. **Substitua** o arquivo existente em:
   ```
   HomeCare/ios/GoogleService-Info.plist
   ```

---

### 4️⃣ Obter Client IDs do Google Cloud Console

**⚠️ IMPORTANTE**: Os Client IDs não estão no Firebase, mas sim no **Google Cloud Console**.

1. Acesse: **[Google Cloud Console](https://console.cloud.google.com/)**
2. Selecione o mesmo projeto do Firebase
3. No menu lateral, vá em **APIs & Services** → **Credentials** (Credenciais)
4. Você verá 3 OAuth 2.0 Client IDs criados automaticamente pelo Firebase:

   - **Web client (auto created by Google Service)** → Use este como `GOOGLE_WEB_CLIENT_ID`
   - **Android client (auto created by Google Service)** → Já está no `google-services.json`
   - **iOS client (auto created by Google Service)** → Já está no `GoogleService-Info.plist`

5. **Copie** o **Web Client ID** (formato: `123456789-abc.apps.googleusercontent.com`)

---

### 5️⃣ Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env` na raiz do projeto:

```env
# .env
GOOGLE_WEB_CLIENT_ID=SEU_WEB_CLIENT_ID_AQUI.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=SEU_IOS_CLIENT_ID.apps.googleusercontent.com (opcional)
GOOGLE_ANDROID_CLIENT_ID=SEU_ANDROID_CLIENT_ID.apps.googleusercontent.com (opcional)
```

**Nota**: Se não configurar iOS/Android Client IDs no `.env`, o Expo usará automaticamente os que estão nos arquivos `google-services.json` e `GoogleService-Info.plist`.

---

### 6️⃣ Encontrar os Client IDs nos Arquivos Baixados

#### Android (`google-services.json`):

```json
{
  "client": [
    {
      "oauth_client": [
        {
          "client_id": "123-android.apps.googleusercontent.com", // Android Client ID
          "client_type": 1
        },
        {
          "client_id": "123-web.apps.googleusercontent.com", // Web Client ID (USE ESTE)
          "client_type": 3
        }
      ]
    }
  ]
}
```

#### iOS (`GoogleService-Info.plist`):

```xml
<key>CLIENT_ID</key>
<string>123-ios.apps.googleusercontent.com</string> <!-- iOS Client ID -->
```

---

## 🚀 Próximos Passos para Testar

### 1. Rebuild do App

Como alteramos configurações nativas, é necessário fazer rebuild:

```bash
# Limpar cache
npx expo start -c

# Android (Development Build)
eas build --profile development --platform android

# iOS (Development Build)
eas build --profile development --platform ios
```

### 2. Testar no Expo Go (Limitado)

O Expo Go **não suporta** Firebase Auth nativo totalmente. Use **Development Build** ou **Preview Build** para testar.

### 3. Configurar Reverse Client ID (iOS - Opcional)

Se estiver usando `@react-native-google-signin` em vez de `expo-auth-session`, adicione ao `app.config.ts`:

```typescript
ios: {
  infoPlist: {
    CFBundleURLTypes: [
      {
        CFBundleURLSchemes: [
          "com.googleusercontent.apps.123-REVERSED" // Reversed iOS Client ID
        ]
      }
    ]
  }
}
```

---

## 📝 Checklist de Validação

- [ ] SHA-1 adicionada ao Firebase (Android app)
- [ ] Google Sign-In habilitado no Firebase Authentication
- [ ] `google-services.json` baixado e substituído (Android)
- [ ] `GoogleService-Info.plist` baixado e substituído (iOS)
- [ ] Web Client ID copiado do Google Cloud Console
- [ ] `.env` criado com `GOOGLE_WEB_CLIENT_ID`
- [ ] Rebuild do app (Development ou Preview build)
- [ ] Teste de login com Google no dispositivo real/emulador

---

## 🐛 Troubleshooting

### Erro: "Developer Error" no Google Sign-In

**Causa**: SHA-1 não registrada ou Client ID incorreto.

**Solução**:
1. Verifique se a SHA-1 foi adicionada corretamente
2. Aguarde 5-10 minutos para propagação das mudanças
3. Reconstrua o app

### Erro: "auth/account-exists-with-different-credential"

**Causa**: Email já registrado com senha.

**Solução**: Usuário deve fazer login com email/senha primeiro e depois vincular Google nas configurações.

### Erro: Client ID not found

**Causa**: `.env` não carregado ou Client ID errado.

**Solução**:
1. Verifique se o `.env` está na raiz do projeto
2. Reinicie o servidor Expo (`npx expo start -c`)
3. Confirme que o Client ID é o **Web Client ID**

---

## 📱 Testando a Implementação

### Fluxo de Teste 1: Novo Usuário com Google

1. Abra o app
2. Na tela de Login, clique em **"Continuar com Google"**
3. Escolha uma conta Google
4. Confirme permissões
5. ✅ Deve criar conta e fazer login automaticamente

### Fluxo de Teste 2: Conta Existente (Email/Senha) Vincular Google

1. Faça login com email/senha
2. Vá em **Perfil** → **Gerenciar Conta** (quando implementado)
3. Clique em **"Vincular Google"**
4. Escolha conta Google
5. ✅ Deve vincular e mostrar ambos métodos

### Fluxo de Teste 3: Conflito de Email

1. Registre com email `teste@example.com` e senha
2. Faça logout
3. Tente fazer login com Google usando `teste@example.com`
4. ✅ Deve mostrar erro pedindo para fazer login com senha primeiro

---

## 🎉 Implementação Concluída!

✅ **Código implementado:**
- AuthContext com métodos Google (signInWithGoogle, linkWithGoogle, etc.)
- GoogleSignInButton component
- Integração na LoginScreen
- Schema Firestore atualizado (providers, hasPassword)

🚧 **Próximos passos (opcionais):**
- Implementar AccountManagementScreen (gerenciar métodos de login)
- Adicionar Google Sign-In na RegisterScreen
- Adicionar testes automatizados

---

**SHA-1 do seu Keystore de Debug:**
```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

**Use esta SHA-1 no Firebase Console conforme instruções acima!** 🔑
