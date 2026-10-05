# Contribuindo

## Verificações locais

As mesmas verificações rodam no CI (`.github/workflows/ci.yml`) em cada pull request:

| Comando                                                      | O que faz                                               |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| `bun run lint`                                               | ESLint (sem warnings permitidos) + checagem do Prettier |
| `bun run format`                                             | Corrige automaticamente o que for possível              |
| `bun run typecheck`                                          | Checagem de tipos com `tsc --noEmit`                    |
| `bun run test`                                               | Testes unitários (`bun test`)                           |
| `bun run expo:doctor`                                        | Verifica a configuração e dependências Expo             |
| `bunx expo prebuild --platform android --no-install --clean` | Gera o projeto nativo Android                           |
| `bunx expo export --platform android`                        | Gera o bundle JavaScript                                |
| `android/gradlew -p android --no-daemon assembleRelease`     | Compila o APK Android após o prebuild                   |

No Bun 1.2.15 usado pelo CI/container, a descoberta conjunta de suites `node:test` pode omitir arquivos. O CI executa as regressões Google separadamente; para reproduzir essa verificação localmente:

```bash
bun test src/utils/googleSignInConfig.test.ts
bun test src/utils/googleSignIn.test.ts
```

O prebuild de iOS precisa do `GoogleService-Info.plist`, que não fica no repositório.

## Dev Container e builds Android

O projeto inclui um `.devcontainer` com Node 22, Bun 1.2.15, Java 17 e o Android SDK necessários para desenvolvimento e builds nativos Android. No VS Code, abra a paleta de comandos e execute **Dev Containers: Reopen in Container**. As dependências serão instaladas automaticamente com `bun install --frozen-lockfile`.

A configuração padrão extrai o Web OAuth client ID do `google-services.json` Android. Não é necessário criar `.env` para o build padrão. Para usar um arquivo Firebase diferente ou um override explícito de client ID, crie o arquivo local sem versioná-lo:

```bash
cp .env.example .env
# Descomente GOOGLE_SERVICES_JSON ou GOOGLE_WEB_CLIENT_ID somente se necessário.
```

O helper oferece os dois caminhos de build:

```bash
# Build local para validar o release (AAB por padrão; APK também é possível)
.devcontainer/build-android.sh local
.devcontainer/build-android.sh local apk

# Build de produção assinado pelo EAS (gera o AAB de produção)
.devcontainer/build-android.sh eas
```

O build local gera o projeto nativo ignorado em `android/` e coloca os artefatos em `android/app/build/outputs/`. Ele não substitui a assinatura de produção: para publicar, use o caminho EAS, faça `eas login` e configure as credenciais e os overrides necessários no EAS. O `google-services.json` selecionado fornece o Web OAuth client ID automaticamente; um `GOOGLE_WEB_CLIENT_ID` explícito e válido tem prioridade. Valores inválidos ou placeholders fazem a avaliação da configuração falhar, em vez de produzir um app com login quebrado.

O comando `bunx expo export --platform android --output-dir dist` usado no CI gera somente o bundle JavaScript e os assets; ele não gera APK nem AAB. O CI também compila com Gradle um APK de release sem assinatura de produção, restrito a x86_64 para o emulador E2E; isso valida o build nativo sem gerar o pacote completo de arquiteturas de produção.

## Login com Google no Android

Para validar o login, alinhe **projeto Firebase + Web OAuth client ID + package + certificado do APK instalado**. O seletor de contas pode abrir mesmo quando a configuração OAuth está incorreta.

1. No projeto Firebase correspondente ao arquivo selecionado, abra **Authentication → Sign-in method** e habilite **Google**, configurando o email de suporte.
2. Em **Project settings → Your apps**, selecione o app Android com package `com.pedrorbc.HomeCare`. Cadastre os fingerprints **SHA-1 e SHA-256** de cada assinatura usada:
   - Local/debug: após o prebuild, consulte `android/gradlew -p android signingReport`.
   - EAS: consulte as credenciais Android com `eas credentials -p android`. Se precisar inspecionar o keystore baixado, use `keytool -list -v -keystore /caminho/keystore.jks`; não versione o keystore nem sua senha.
   - Google Play: em **App integrity → App signing**, use os fingerprints do **App signing key certificate**. A upload key não é necessariamente a assinatura que chega ao dispositivo.
3. Para conferir um APK específico, use `apksigner verify --print-certs /caminho/app.apk` (Android SDK Build Tools). Compare os SHA-1/SHA-256 exibidos com o cadastro Firebase. Para inspecionar a instalação atual, obtenha o caminho com `adb shell pm path com.pedrorbc.HomeCare` e copie o `base.apk` usando `adb pull` antes de rodar `apksigner`.
4. Depois de habilitar Google/cadastrar os certificados, baixe o **`google-services.json` atualizado**. Substitua o arquivo do projeto ou aponte `GOOGLE_SERVICES_JSON` para ele. A configuração seleciona o OAuth **web (`client_type: 3`)** do package correto; não use o OAuth Android (`client_type: 1`) como `GOOGLE_WEB_CLIENT_ID`.
5. Verifique se não existe override inválido em `.env` ou nas variáveis EAS. `eas.json` **não expande** `"$GOOGLE_WEB_CLIENT_ID"`; não use referências shell como valores de `env`. Se um arquivo secreto EAS não estiver disponível durante a avaliação local da configuração, forneça um arquivo local equivalente ou um `GOOGLE_WEB_CLIENT_ID` válido nessa etapa. A resolução não troca silenciosamente um arquivo alternativo pelo padrão.
6. **Recompile e instale o app atualizado**; reiniciar o app antigo não altera os IDs embutidos. No desenvolvimento local, use `bun run android`; para testar um APK release local, use `.devcontainer/build-android.sh local apk`; para o APK interno EAS, use `eas build --profile preview --platform android`.

Confirme no build instalado: login com conta Google existente, primeiro login de conta nova, cancelamento sem alerta e vinculação a uma conta email/senha existente. Não considere apenas lint/testes/CI como comprovação de OAuth: a validação final precisa do app assinado e de uma conta Google.

Se continuar falhando, registre **a etapa e o código do erro, nunca tokens**. A mensagem de conexão Google aponta para o SDK/obtenção de token; o erro de login após obter o token pode vir do Firebase Auth ou da criação do perfil Firestore. Se `Firebase Auth.currentUser` já existir após a falha, investigue o perfil separadamente antes de mudar as credenciais OAuth.

## Teste E2E Android

O smoke test de interface usa Maestro e percorre Login → Cadastro → Login sem enviar credenciais nem gravar dados no Firebase. Com Java 17, Android SDK, Bun e o Maestro CLI no `PATH`, gere e instale o APK:

```bash
CI=1 bunx expo prebuild --platform android --no-install --clean
chmod +x android/gradlew
android/gradlew -p android --no-daemon --no-parallel assembleRelease
adb install android/app/build/outputs/apk/release/app-release.apk
maestro test .maestro/auth-navigation.yaml
```

O fluxo requer a configuração Android `google-services.json` já versionada, mas não exige `GOOGLE_WEB_CLIENT_ID` nem conta de teste.

O container Linux não consegue gerar binários iOS, pois iOS exige macOS/Xcode e credenciais Apple. Use um Mac ou um build EAS para iOS e forneça o `GoogleService-Info.plist` separadamente.
