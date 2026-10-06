# Contribuindo

## Verificações locais

As mesmas verificações rodam no CI (`.github/workflows/ci.yml`) em cada pull request:

| Comando                                                      | O que faz                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `bun run lint`                                               | ESLint (sem warnings permitidos) + checagem do Prettier        |
| `bun run format`                                             | Corrige automaticamente o que for possível                     |
| `bun run typecheck`                                          | Checagem de tipos com `tsc --noEmit`                           |
| `bun run test`                                               | Testes de `src`, isolados por arquivo, com relatórios JUnit    |
| `bun run test:ci-helpers`                                    | Regressões dos helpers de testes, APK e diagnósticos           |
| `bun run lint:workflows`                                     | actionlint 1.7.12 + ShellCheck (precisa de ShellCheck no PATH) |
| `bun run expo:doctor`                                        | Verifica a configuração e dependências Expo                    |
| `bunx expo prebuild --platform android --no-install --clean` | Gera o projeto nativo Android                                  |
| `bunx expo export --platform android`                        | Gera o bundle JavaScript                                       |
| `android/gradlew -p android --no-daemon assembleRelease`     | Compila o APK Android após o prebuild                          |

No Bun 1.2.15 usado pelo CI/container, a descoberta conjunta de suites `node:test` pode omitir arquivos. `bun run test` descobre os arquivos `*.test.*`, `*.spec.*`, `*_test.*` e `*_spec.*` em `src` e executa um processo Bun por arquivo. O runner rejeita descoberta vazia, relatório ausente/inválido, arquivo sem testes registrados e subprocesso falho; não basta o comando retornar zero. Os relatórios ficam em `reports/unit-tests/`, e as contagens são exibidas no log. Atualmente são 40 testes em 8 arquivos, sem limite fixo no runner nem alegação de cobertura percentual.

Os helpers precisam de Node 22, Python 3 e ferramentas GNU/Linux (`timeout`, `realpath`) para reproduzir todos os testes. Para validar workflows fora de Linux x86_64, instale actionlint 1.7.12 e defina `ACTIONLINT_BIN`; no Linux x86_64, o helper baixa essa versão e verifica seu checksum. O CI também executa zizmor 1.30.1 sem uploads SARIF/Advanced Security nem auditorias online.

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

O comando `bunx expo export --platform android --output-dir dist` gera somente o bundle JavaScript e os assets; ele não gera APK nem AAB. No CI, `assembleRelease` já embute o bundle/bytecode Hermes no APK, evitando um export separado redundante. O build usa Java 17, SDK/Build Tools 36, NDK 27.1.12297006 e CMake 3.22.1, sem mudar a stack Expo/RN.

## APK de preview em cada PR

Toda PR dispara o build, sem label e sem filtro por caminho. Na aba **Actions → CI → execução da PR**, baixe o artifact `android-preview-<PR>-<tentativa>` ou use o link no resumo do job **Android preview APK (ARM64 + x86_64)**. Ele fica disponível por **7 dias**, respeitando também a política de retenção do repositório. É necessário acesso autenticado ao repositório privado. Um novo commit cancela a execução anterior da mesma PR.

O artifact contém:

- `app-release.apk`: um único APK universal para celulares **ARM64** e emuladores **x86_64**, sem precisar de Metro. Não atende dispositivos Android 32-bit.
- `app-release.apk.sha256`: checksum do APK; na pasta descompactada, valide com `sha256sum --check app-release.apk.sha256`.
- `metadata.json`: SHA efetivamente compilado (merge da PR), head SHA, número da PR, execução/tentativa, versão, package, ABIs, bundle e certificado observado.
- `signature.txt` e `manifest.txt`: saída de `apksigner verify --print-certs` e `aapt dump badging`. A inspeção ZIP, sozinha, não comprova assinatura.

O build rejeita assinatura inválida, package diferente de `com.pedrorbc.HomeCare`, bundle ausente/vazio e runtime nativo ausente em qualquer ABI exigida. O **mesmo APK e checksum** são baixados pelo job Maestro. O upload acontece antes do smoke e independe de lint/auditoria, permitindo avaliar o preview mesmo quando outro check falha.

Instale com `adb install -r app-release.apk` ou pelo instalador do celular. A assinatura é a de desenvolvimento do template gerado pelo Expo, **não a de produção**; não são usados keystore de produção, token EAS ou secrets. Não é gerada uma chave aleatória por execução. Se já existir um app com o mesmo package e certificado diferente (por exemplo, Play/EAS), pode ser necessário desinstalá-lo antes — **isso apaga os dados locais**. Confira o certificado real de cada artifact, não assuma o certificado do `~/.android/debug.keystore` local.

**Preview não é sandbox Firebase.** Preserva o package e o `google-services.json` existentes; operações manuais autenticadas podem atingir o backend real. Sem Metro não significa sem internet. O smoke não faz login nem grava dados de domínio. O login Google exige os fingerprints do APK cadastrados no Firebase e teste manual com conta; build/smoke verdes não comprovam OAuth. O fluxo de produção EAS permanece separado e inalterado.

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
android/gradlew -p android --no-daemon --no-parallel --max-workers=2 \
  -PreactNativeArchitectures=arm64-v8a,x86_64 assembleRelease
python3 -I scripts/inspect-android-apk.py \
  android/app/build/outputs/apk/release/app-release.apk reports/android-preview \
  --build-tools "$ANDROID_HOME/build-tools/36.0.0"
# Com emulador/dispositivo de teste já conectado:
bash scripts/android-smoke.sh reports/android-preview/app-release.apk reports/android-smoke
```

O fluxo requer a configuração Android `google-services.json` já versionada, mas não exige `GOOGLE_WEB_CLIENT_ID` nem conta de teste. A espera inicial é limitada a 30 segundos. O helper registra a coleta de diagnósticos **antes da instalação**, preserva o status original do install/Maestro e não faz retries para mascarar falhas. No CI, `android-smoke-diagnostics-<tentativa>` retém por 7 dias logs Maestro, screenshot, hierarquia e logcat limitado ao app (quando a coleta consegue concluir), antes do emulador encerrar. Os logs não incluem deliberadamente token FCM nem payload bruto de notificações; trate qualquer diagnóstico como dado potencialmente sensível e não o publique externamente sem revisão.

## Segurança de dependências e gate do CI

A auditoria OSV funciona também no repositório privado, lê diretamente `bun.lock` e não precisa de GitHub Advanced Security. Em PRs, compara base/head e **bloqueia vulnerabilidades introduzidas**. Em pushes para `master`, merge queue e execução manual de **CI**, o scan completo informa o backlog existente sem bloquear apenas por ele. Erros de scanner/rede ou resultados ausentes continuam falhando.

O workflow **Dependency audit** também roda semanalmente e pode ser disparado manualmente. Nesses caminhos, falha por vulnerabilidades existentes (no manual, `fail-on-existing` vem habilitado). Consulte seus logs e artifacts oficiais OSV, incluindo resultados completos e relatório HTML; **CI verde não significa ausência de vulnerabilidades preexistentes**. Não há upgrades de dependências nem auto-merge implícitos neste fluxo. O scan é de dependências JavaScript/Bun, não uma auditoria de todo o SDK Android ou de dependências Maven.

CodeQL fica ativo em repositório público ou quando a variável `ENABLE_PRIVATE_CODEQL=true` for configurada **depois de habilitar o serviço de code scanning privado**. A variável não concede entitlement. OSV e zizmor não substituem análise de código-fonte CodeQL.

As actions externas estão fixadas por SHA, e Dependabot agrupa atualizações de GitHub Actions para revisão. Atualizações de versão Bun/GitHub Actions aguardam um cooldown de 7 dias após o lançamento; o cooldown não se aplica às atualizações de segurança do Dependabot. APK/testes usam apenas `contents: read`, sem secrets nem checkout com credenciais persistidas; permissões adicionais exigidas pelo reusable oficial OSV ficam limitadas à auditoria. Caches Bun são de downloads, não de `node_modules`; Bun/Gradle só gravam cache compartilhado em pushes confiáveis para `master`. Gradle usa provider `basic`, sem publicar Build Scans. Não há cache AVD nesta etapa.

O check estável **`CI required`** exige qualidade, validação de workflows, auditoria, APK e smoke bem-sucedidos; falha em cancelamento/falha/skip inesperado. **Criar esse check não protege a branch automaticamente**: configure-o como obrigatório em ruleset/proteção de `master` para impedir merge sem CI. Essa configuração administrativa não é alterada pelo workflow.

O container Linux não consegue gerar binários iOS, pois iOS exige macOS/Xcode e credenciais Apple. Use um Mac ou um build EAS para iOS e forneça o `GoogleService-Info.plist` separadamente.
