# Contribuindo

## Verificações locais

As mesmas verificações rodam no CI (`.github/workflows/ci.yml`) em cada pull request:

| Comando                                                      | O que faz                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `bun run lint`                                               | ESLint (sem warnings permitidos) + checagem do Prettier          |
| `bun run format`                                             | Corrige automaticamente o que for possível                       |
| `bun run typecheck`                                          | Checagem de tipos com `tsc --noEmit`                             |
| `bun run test`                                               | Testes de `src`, isolados por arquivo, com relatórios JUnit      |
| `bun run test:ci-helpers`                                    | Regressões dos helpers de testes, APK e diagnósticos             |
| `bun run lint:workflows`                                     | actionlint 1.7.12 + ShellCheck (precisa de ShellCheck no PATH)   |
| `bun run expo:doctor`                                        | Verifica a configuração e dependências Expo                      |
| `bun run config:check`                                       | Valida configuração real local com `.env`, sem imprimir valores  |
| `bun run security:check`                                     | Rejeita arquivos secretos rastreados e padrões selecionados      |
| `bun run deps:check`                                         | Valida peers, engines do Node instalado e pins do compilador CSS |
| `bunx expo prebuild --platform android --no-install --clean` | Gera o projeto nativo Android                                    |
| `bunx expo export --platform android`                        | Gera o bundle JavaScript                                         |
| `android/gradlew -p android --no-daemon assembleRelease`     | Compila o APK Android após o prebuild                            |

Use Bun 1.4.2+ e Node 22.13+. O lock v3 usa overrides restritos por consumidor; versões antigas do Bun não conseguem reproduzi-lo. A descoberta conjunta de suites `node:test` pode omitir arquivos. `bun run test` descobre os arquivos `*.test.*`, `*.spec.*`, `*_test.*` e `*_spec.*` em `src` e executa um processo Bun por arquivo. O runner rejeita descoberta vazia, relatório ausente/inválido, arquivo sem testes registrados e subprocesso falho; não basta o comando retornar zero. Os relatórios ficam em `reports/unit-tests/`, e as contagens são exibidas no log. Atualmente são 44 testes em 9 arquivos, sem limite fixo no runner nem alegação de cobertura percentual.

Os helpers precisam de Node 22, Bun no PATH (1.4.2 no CI), Python 3 e ferramentas GNU/Linux (`timeout`, `realpath`) para reproduzir todos os testes. Os testes de integração executam Bun de verdade e validam seus relatórios JUnit com e sem metadados GitHub, falha de teste e arquivo vazio. Para validar workflows fora de Linux x86_64, instale actionlint 1.7.12 e defina `ACTIONLINT_BIN`; no Linux x86_64, o helper baixa essa versão e verifica seu checksum. O CI também executa zizmor 1.30.1 sem uploads SARIF/Advanced Security nem auditorias online.

A matriz, as restrições temporárias e os comandos de inventário/auditoria estão em [DEPENDENCIES.md](DEPENDENCIES.md).

O prebuild de iOS precisa do `GoogleService-Info.plist`, que não fica no repositório.

## Dev Container e builds Android

O projeto inclui um `.devcontainer` com Node 22, Bun 1.4.2, Java 17 e o Android SDK necessários para desenvolvimento e builds nativos Android. No VS Code, abra a paleta de comandos e execute **Dev Containers: Reopen in Container**. As dependências serão instaladas automaticamente com `bun install --frozen-lockfile`.

O `google-services.json` real e o `.env` são **locais e ignorados pelo Git**. Obtenha a configuração do projeto Firebase existente por um canal privado; não use outro projeto se precisa preservar usuários/dados. O Web OAuth client ID é extraído do JSON selecionado. Prepare o ambiente local:

```bash
cp .env.example .env
# Preencha as referências confirmadas e a expectativa de Facebook; nunca versione valores.
bun run config:check
```

No EAS, `GOOGLE_SERVICES_JSON` é uma variável de **arquivo Secret**; o Web client ID precisa estar disponível à avaliação local da config. Profiles selecionam explicitamente development/preview/production, e o worker Android valida a configuração antes do prebuild. Veja a matriz, a rotação e o TODO em [Credenciais e release](docs/credentials-and-release.md).

O helper oferece os dois caminhos de build:

```bash
# Build local para validar o release (AAB por padrão; APK também é possível)
.devcontainer/build-android.sh local
.devcontainer/build-android.sh local apk

# Build de produção assinado pelo EAS (gera o AAB de produção)
.devcontainer/build-android.sh eas
```

O build local gera o projeto nativo ignorado em `android/` e coloca os artefatos em `android/app/build/outputs/`. Sem as variáveis de assinatura ele usa a chave debug do template; com elas no `.env`, usa a upload key (veja [APK e AAB assinados](#apk-e-aab-assinados-android-release)). O caminho EAS continua disponível: faça `eas login` e configure as credenciais e os overrides necessários no EAS. O `google-services.json` selecionado fornece o Web OAuth client ID automaticamente; um `GOOGLE_WEB_CLIENT_ID` explícito e válido tem prioridade. Valores inválidos ou placeholders fazem a avaliação da configuração falhar, em vez de produzir um app com login quebrado.

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

**O APK de CI usa configuração Firebase sintética `demo-homecare-ci`, sem arquivo real nem secrets.** Valida compilação e navegação, não oferece login real nem comprova OAuth; não se conecta automaticamente aos emuladores. O smoke não faz login nem grava dados de domínio. Builds locais/EAS com configuração real continuam usando o backend escolhido e **não viram sandbox por usar o profile preview**. Para validar login real, use build autorizado com arquivo/certificados corretos e conta de teste, separado do APK sintético de PR.

## APK e AAB assinados (Android release)

O workflow **Android release** (`.github/workflows/release.yml`) gera APK universal e AAB assinados com a **upload key** do Google Play:

- **Tag `v*`** igual à versão do app (ex.: `v2.6.0`): anexa `HomeCare-<tag>.apk`, `HomeCare-<tag>.aab` e `SHA256SUMS` à GitHub Release da tag.
- **Execução manual** (Actions → Android release → Run workflow): o artifact `android-release-<execução>-<tentativa>` fica disponível por 30 dias. Aceita `version-code` e a lista de ABIs (padrão: as quatro do template).

Cadastre no environment **Settings → Environments → `android-release`**, usado pelo job. Ele está restrito a `master` e tags `v*`; configure reviewers se o plano GitHub permitir. Antes da assinatura, o workflow exige o secret `GOOGLE_SERVICES_JSON` (conteúdo JSON) e as variables `FIREBASE_EXPECTED_PROJECT_ID` e `FACEBOOK_ENABLED`; com Facebook habilitado, também `FACEBOOK_APP_ID` e o secret `FACEBOOK_CLIENT_TOKEN`. A variable `GOOGLE_WEB_CLIENT_ID`, quando fornecida, precisa coincidir com o Web OAuth do JSON; sem ela, o ID é extraído do arquivo. Consulte [a matriz completa](docs/credentials-and-release.md#contrato-local--eas--github). Não forneça esses secrets ao CI de PR.

| Nome                                  | Tipo                | Conteúdo                                                                |
| ------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`             | secret              | Keystore em base64: `base64 -w0 upload-keystore.jks`                    |
| `ANDROID_KEYSTORE_PASSWORD`           | secret              | Senha do keystore                                                       |
| `ANDROID_KEY_ALIAS`                   | secret              | Alias da chave                                                          |
| `ANDROID_KEY_PASSWORD`                | secret (opcional)   | Senha da chave; padrão = senha do keystore                              |
| `ANDROID_VERSION_CODE_OFFSET`         | variable (opcional) | Somado ao número da execução para gerar o `versionCode` (padrão 0)      |
| `ANDROID_EXPECTED_UPLOAD_CERT_SHA256` | variable            | SHA-256 do certificado **upload**, confirmado independentemente no Play |

- **Qual chave:** o app já foi enviado ao teste interno Play; recupere a mesma upload key (`eas credentials -p android` → download do keystore) e compare com o certificado upload na Play. Nunca versione o keystore. Não gere outra chave às cegas; reset somente por perda/comprometimento confirmado e pelo procedimento oficial, preservando a app signing key.
- **`versionCode`:** o Play exige um valor maior que o último enviado. Ajuste `ANDROID_VERSION_CODE_OFFSET` acima do maior já publicado ou informe `version-code` na execução manual.
- **Verificação:** o job falha sem configuração/secrets, com tag diferente da versão, com certificado upload divergente da referência Play, ou se APK (`apksigner`) e AAB (`jarsigner`) não forem assinados somente pelo certificado esperado. O resumo mostra fingerprints públicos, nunca senhas.
- **Login Google:** APKs instalados fora do Play usam a upload key; cadastre esses fingerprints no Firebase. Instalações pelo Play usam a App signing key (veja abaixo).

Localmente, defina as mesmas variáveis no `.env` (veja `.env.example`; aqui o keystore vai em `ANDROID_KEYSTORE_PATH`). `.devcontainer/build-android.sh local apk` carrega o `.env` e passa a assinar com a upload key, exigindo a conferência de `ANDROID_EXPECTED_UPLOAD_CERT_SHA256` antes do prebuild; sem configuração de assinatura, continua usando a chave debug do template. `scripts/android-release.sh` lê apenas variáveis exportadas; para gerar e verificar APK + AAB como o CI:

```bash
set -a && source .env && set +a
node scripts/verify-build-config.mjs --mode release
bash scripts/android-release.sh reports/android-release
```

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

## Login com Facebook (Meta)

O login Facebook é nativo e exige um novo prebuild/rebuild; não funciona no Expo Go e não há suporte web declarado. Configure no ambiente de desenvolvimento e no EAS:

1. Crie/configure um app Meta e defina `FACEBOOK_APP_ID` e `FACEBOOK_CLIENT_TOKEN` no ambiente seguro usado pelo build. O **App Secret da Meta nunca entra no app**: mantenha-o somente no console do Firebase, quando a configuração do provedor exigir.
2. No Firebase Console, habilite o provedor Facebook em **Authentication → Sign-in method**, informe o App ID/Secret e cadastre a URI de redirecionamento mostrada pelo Firebase no app Meta. Não versione segredos.
3. No Meta, configure o package Android `com.pedrorbc.HomeCare` e cadastre o hash de chave Android correto (SHA-1 convertido para Base64) para cada certificado que assina o APK: debug/local, EAS e **App signing key certificate** do Google Play. A upload key não substitui o certificado de assinatura distribuído.
4. Para iOS, configure no Meta o bundle ID `com.pedrorbc.HomeCare`, forneça o `GoogleService-Info.plist` do Firebase e habilite `ios.googleServicesFile` em `app.config.ts` (atualmente comentado), sem versionar credenciais. Faça um build nativo; o plugin configura o esquema `fb<APP_ID>`, e o login limitado usa nonce seguro. Revise a App Store Review 4.8 antes de publicar: avalie Sign in with Apple ou outra opção que satisfaça todos os requisitos de privacidade, incluindo ocultar o email; Google por si só não é garantia de conformidade.
5. Antes de publicar, deixe o app Meta em modo Live, configure os papéis de teste, URLs públicas de política de privacidade e exclusão de dados e confirme os requisitos de revisão. Este projeto não implementa webhook de exclusão de dados.

Ao escolher esse login, a Meta confirma a identidade e pode fornecer nome, foto e email (que pode faltar), usados pelo Firebase para autenticação e perfil. Dados de casas, cuidadores, escalas e pagamentos não são enviados à Meta; o SDK não é usado para publicidade nem analytics automático. Preserve a configuração de release para não deixar sem acesso usuários que só tenham Facebook vinculado.

## Teste E2E Android

O smoke test de interface usa Maestro e percorre Login → Cadastro → Login sem enviar credenciais nem gravar dados no Firebase. Com Java 17, Android SDK, Bun e o Maestro CLI no `PATH`, gere e instale o APK:

```bash
export GOOGLE_SERVICES_JSON=./scripts/fixtures/firebase-ci.json
export GOOGLE_WEB_CLIENT_ID= FACEBOOK_APP_ID= FACEBOOK_CLIENT_TOKEN=
export FACEBOOK_ENABLED=false
node scripts/verify-build-config.mjs --mode demo
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

O CI fornece a configuração Android sintética `scripts/fixtures/firebase-ci.json`. Para reproduzi-lo localmente, exporte `GOOGLE_SERVICES_JSON` para esse caminho, `GOOGLE_WEB_CLIENT_ID` vazio e `FACEBOOK_ENABLED=false`, removendo App ID/Client Token Facebook do ambiente. Não há arquivo real versionado nem conta de teste no smoke; login produtivo requer validação separada. A espera inicial é limitada a 30 segundos. O helper registra a coleta de diagnósticos **antes da instalação**, preserva o status original do install/Maestro e não faz retries para mascarar falhas. No CI, `android-smoke-diagnostics-<tentativa>` retém por 7 dias logs Maestro, screenshot, hierarquia e logcat limitado ao app (quando a coleta consegue concluir), antes do emulador encerrar. Os logs não incluem deliberadamente token FCM nem payload bruto de notificações; trate qualquer diagnóstico como dado potencialmente sensível e não o publique externamente sem revisão.

## Segurança de dependências e gate do CI

A auditoria OSV funciona também no repositório privado, lê diretamente `bun.lock` e não precisa de GitHub Advanced Security. Em PRs, compara base/head e **bloqueia vulnerabilidades introduzidas**. Em pushes para `master`, merge queue e execução manual de **CI**, o scan completo informa o backlog existente sem bloquear apenas por ele. Erros de scanner/rede ou resultados ausentes continuam falhando.

O workflow **Dependency audit** também roda semanalmente e pode ser disparado manualmente. Nesses caminhos, falha por vulnerabilidades existentes (no manual, `fail-on-existing` vem habilitado). Consulte seus logs e artifacts oficiais OSV, incluindo resultados completos e relatório HTML; **CI verde não significa ausência de vulnerabilidades preexistentes**. Não há upgrades de dependências nem auto-merge implícitos neste fluxo. O scan é de dependências JavaScript/Bun, não uma auditoria de todo o SDK Android ou de dependências Maven.

CodeQL fica ativo em repositório público ou quando a variável `ENABLE_PRIVATE_CODEQL=true` for configurada **depois de habilitar o serviço de code scanning privado**. A variável não concede entitlement. OSV e zizmor não substituem análise de código-fonte CodeQL.

As actions externas estão fixadas por SHA, e Dependabot agrupa atualizações de GitHub Actions para revisão. Atualizações de versão Bun/GitHub Actions aguardam um cooldown de 7 dias após o lançamento; o cooldown não se aplica às atualizações de segurança do Dependabot. APK/testes do CI usam apenas `contents: read`, sem secrets nem checkout com credenciais persistidas; somente o **Android release** lê os secrets de assinatura, sem caches compartilhados, e a escrita da GitHub Release fica num job separado que não executa código do projeto; permissões adicionais exigidas pelo reusable oficial OSV ficam limitadas à auditoria. Caches Bun são de downloads, não de `node_modules`; Bun/Gradle só gravam cache compartilhado em pushes confiáveis para `master`. Gradle usa provider `basic`, sem publicar Build Scans. Não há cache AVD nesta etapa.

O check estável **`CI required`** exige qualidade, validação de workflows, auditoria, APK e smoke bem-sucedidos; falha em cancelamento/falha/skip inesperado. **Criar esse check não protege a branch automaticamente**: configure-o como obrigatório em ruleset/proteção de `master` para impedir merge sem CI. Essa configuração administrativa não é alterada pelo workflow.

O container Linux não consegue gerar binários iOS, pois iOS exige macOS/Xcode e credenciais Apple. Use um Mac ou um build EAS para iOS e forneça o `GoogleService-Info.plist` separadamente.
