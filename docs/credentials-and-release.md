# Credenciais, configuração e preparação para abrir o repositório

## Escopo e inventário inicial de 2026-10-11

O objetivo é tirar configurações reais do Git e substituir o material exposto, mantendo o mesmo Firebase, usuários/UIDs, dados, package e aplicação Play existente. **Não alterar `house_keys` nem o esquema de criptografia.** As chaves das casas são geradas em runtime no Firestore, não são variáveis de build. Somente membros autorizados devem lê-las; regras no repo não comprovam o estado implantado.

`google-services.json` contém configuração **cliente** Firebase, inclusive API key e OAuth IDs. Não é service account. Seus dados entram no APK: EAS Secret/.env controlam armazenamento, não os tornam secretos no app. Proteger o backend com Authentication, Security Rules/IAM e restrições de API compatíveis. Nunca incluir Meta App Secret, service accounts, tokens de usuários ou chave privada no cliente.

A auditoria local de 1.593 blobs alcançáveis em todas as referências Git disponíveis encontrou três versões do arquivo Firebase contendo **uma API key cliente distinta**, no mesmo projeto. Não houve correspondência dos padrões pesquisados de private keys, service accounts, tokens GitHub, OAuth client secrets Google e AWS access keys. **Não é uma auditoria exaustiva**, nem inclui dados das consoles, objetos não alcançáveis ou segredos em outros clones/forks.

### TODO e responsabilidade

| Ordem | Tarefa                                                                 | Estado / responsável                                                                              |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1     | Inventário de arquivos/histórico com saída redigida                    | Executado no escopo acima; nenhuma credencial administrativa confirmada                           |
| 2     | Retirar JSON real do Git, preservando arquivo local; ampliar ignore    | Preparado no código; JSON/.env locais protegidos e ignorados                                      |
| 3     | Testes/CI independentes de configuração real                           | Configuração sintética e verificações preparadas; veja os checks da PR                            |
| 4     | Conferir projeto Firebase, providers e regras efetivamente implantadas | Pendente: usuário no Firebase Console; não fazer deploy automático                                |
| 5     | Criar Firebase API key substituta no mesmo projeto e restringir APIs   | Pendente: usuário no Google Cloud Console; não excluir a antiga ainda                             |
| 6     | Atualizar configuração local e EAS com a substituta                    | Configuração atual sincronizada em 2026-10-15; substituição da API key continua pendente          |
| 7     | Provisionar environment GitHub `android-release`                       | Configurado em 2026-10-15 com secrets/variables; limitado a `master` e tags `v*`, sem reviewer    |
| 8     | Conferir upload key, Play app signing certificate e versionCode        | Certificados conferidos; upload EAS/local coincide com Play; versionCode 29 definido pelo usuário |
| 9     | Sincronizar Google/Facebook/assinatura GitHub e EAS                    | Configuração atual enviada; preflight local passou; build aceita pelo usuário em 2026-10-17       |
| 10    | Validar login e atualização pelo teste interno                         | Build aceita pelo usuário; sem novo teste independente nesta etapa; envio Play será manual        |
| 11    | Retirar credenciais antigas e resolver histórico antes de abrir o repo | Pendente de validação e autorização; sem force-push ou abertura automática                        |

### Estado remoto inicial — 2026-10-11

- EAS: projeto vinculado confirmado; `GOOGLE_SERVICES_JSON` existe como **file/Secret** em development, preview e production. Seu conteúdo não pode ser lido de volta e **não foi comparado** nem substituído.
- `GOOGLE_WEB_CLIENT_ID` EAS coincide com o arquivo local nos três environments; somente o resultado da comparação foi registrado. `GOOGLE_ANDROID_CLIENT_ID` existe, mas o SDK atual não o consome.
- Não foram encontrados `FIREBASE_EXPECTED_PROJECT_ID`, `FACEBOOK_ENABLED`, `FACEBOOK_APP_ID` ou `FACEBOOK_CLIENT_TOKEN` nesses environments. Nenhuma variável account-wide foi encontrada.
- GitHub: nenhum secret/variable no nível do repositório foi encontrado antes da preparação; `android-release` foi criado sem carregar credenciais. Confirmar também eventual escopo organizacional.
- Restringir branches/tags não equivale a exigir revisão humana. Configure reviewers se o plano GitHub permitir; não conceda permissões mais amplas apenas para contornar uma limitação.

### Sincronização executada — 2026-10-15

- Destinos conferidos antes das escritas: projeto EAS existente, package Android preservado e environment GitHub `android-release` deste repositório. Nenhuma variável compartilhada da conta EAS foi encontrada.
- A única credencial Android EAS está marcada como padrão. Seus fingerprints SHA-1/SHA-256 coincidem com o certificado **upload** mostrado pelo usuário na Play Console. O keystore existente foi recuperado para assinatura local/GitHub; o certificado extraído dos bytes recuperados também foi comparado à referência independente da Play. Não houve geração, reset ou substituição da credencial EAS nem da app signing key.
- Local: `.env`, JSON e cópia do upload keystore continuam ignorados e com permissões `0600`; `.secrets/` usa `0700`. Há backup privado da configuração anterior. O pin do certificado, caminho, alias e senhas da chave existente foram configurados sem exibir valores. O SDK Android local também foi localizado/configurado. A validação de configuração real, o preflight de assinatura e a checagem de arquivos rastreados passaram.
- EAS: o JSON local atual foi enviado como file/Secret, e Web client ID, expectativa de projeto Firebase, Facebook habilitado/App ID/Client Token e referência do certificado foram sincronizados em **development, preview e production**. O Client Token usa **Sensitive**; o JSON permanece **Secret**. A chave gerenciada continua no sistema de credenciais Android, sem duplicar suas senhas nas variáveis EAS. A variável Android OAuth antiga foi preservada, embora não seja consumida pelo runtime atual.
- GitHub `android-release`: foram gravadas cinco variables do contrato e seis secrets: JSON, Client Token e quatro campos de assinatura (keystore base64, senha, alias e senha da chave). Secrets foram enviados por stdin e criptografados pelo `gh`, sem valores em argv ou logs. As variables foram comparadas por leitura de volta; a presença dos secrets foi conferida por metadados. As restrições continuam `master` e tags `v*`, sem reviewer obrigatório.
- As operações de escrita EAS/GitHub foram aceitas, mas secrets não permitem leitura de volta para comprovar igualdade byte a byte. O arquivo Secret EAS anterior não foi lido nem comparado: foi atualizado a partir da cópia local validada. **Ainda não houve build consumidor nem teste OAuth com essa sincronização.** O pin no ambiente EAS é uma referência de auditoria; não substitui a conferência da credencial gerenciada nem cria um preflight automático no worker EAS.
- O certificado público de **app signing**, fornecido separadamente pelo usuário, é distinto da upload key. O usuário confirmou seu cadastro no Firebase/Meta; isso não comprova que todos os certificados de APK direto já estejam cadastrados. Não foram modificados providers, regras ou dados do backend; a expectativa Firebase continua derivada do arquivo existente, sem nova confirmação independente na console.
- O contador Android remoto EAS consultado era **27** (versão **2.5.0**). A Play Console exigiu login no navegador disponível; o maior versionCode já enviado não foi consultado. Não alterar contadores às cegas: conferir esse máximo antes de construir/enviar e coordenar também o contador independente do GitHub.
- Não há service account de submissão Play associada às credenciais EAS consultadas. Isso não impede build assinado ou envio manual do AAB pela console; somente a submissão automatizada depende dessa configuração adicional. Não foi criada uma credencial administrativa por conveniência.
- Esta etapa **não rotacionou a API key Firebase**, não revogou chaves, não publicou app, não iniciou build/submit, não alterou `house_keys` e não mesclou PRs. A configuração atual foi alinhada; substituição do material exposto e validação em teste interno continuam tarefas distintas.

### Decisões e atualização — 2026-10-17

- O usuário definiu **versionCode 29** e pediu considerar a build válida. Essa aceitação é informação do usuário; não houve novo build, inspeção do AAB, teste OAuth ou instalação independente nesta etapa. Alterar configuração não modifica um artefato já compilado.
- Projeto/package EAS conferidos novamente: o contador remoto estava em **27** (versão **2.5.0**) e foi atualizado para **29**, com leitura de volta confirmada. `production.autoIncrement` agora é `false`: com `true`, o próximo build incrementaria 29 para 30. A fonte continua remota; a próxima versão deverá ser incrementada explicitamente antes de outro envio com código novo.
- O `.env` local ignorado recebeu `ANDROID_VERSION_CODE=29`, com backup privado e permissões preservadas; o check de configuração real passou. EAS usa o contador remoto, não esse override local. No workflow GitHub, usar a entrada explícita **`version-code: 29`** ao executar manualmente; o fallback `offset + run_number` continua independente e não foi alterado. A consulta de variables GitHub retornou HTTP 401 nesta sessão; não houve alteração remota delas.
- **EAS Submit está fora do escopo por decisão do usuário.** Não criar service account Play nem executar `eas submit`/`--auto-submit`; o AAB será enviado manualmente pelo usuário. A seção declarativa `submit` existente não dispara submissões por si só e foi preservada.
- A API key cliente atual **ainda não foi rotacionada**. A aceitação da build com a configuração atual não valida uma futura chave substituta; depois da troca será preciso conferir os fluxos afetados antes de retirar a antiga. Dados, UIDs, providers, certificados e `house_keys` permanecem inalterados.

## Contrato local / EAS / GitHub

Nomes são públicos; **valores reais ficam fora do Git**. Não copie valores reais para issues, PRs, commits, screenshots ou logs.

Neste worktree, o JSON real foi preservado na raiz e uma cópia anterior à rotação fica em `.secrets/google-services.before-rotation.json`. **Antes de atualizar outro checkout que ainda rastreia esse arquivo**, faça ali um backup privado fora do caminho rastreado: aplicar o commit que o remove pode apagar a cópia daquele checkout. Depois restaure o arquivo local ignorado ou configure `GOOGLE_SERVICES_JSON` para o backup. Não envie o backup ao Git.

| Nome                                                                     | Local                                                          | EAS                                                            | GitHub `android-release`                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `GOOGLE_SERVICES_JSON`                                                   | Caminho do JSON ignorado, normalmente `./google-services.json` | **File / Secret**; o worker recebe um caminho                  | **Secret** com conteúdo JSON; materializado temporariamente pelo workflow |
| `GOOGLE_WEB_CLIENT_ID`                                                   | `.env`, OAuth Web tipo 3                                       | Plaintext ou sensitive, disponível à avaliação local da config | Variable                                                                  |
| `FIREBASE_EXPECTED_PROJECT_ID`                                           | `.env`, confirmado independentemente na console                | Plaintext ou sensitive                                         | Variable                                                                  |
| `FACEBOOK_ENABLED`                                                       | `.env`, `true` ou `false` conforme providers preservados       | Plaintext ou sensitive                                         | Variable                                                                  |
| `FACEBOOK_APP_ID`                                                        | `.env`, somente se habilitado                                  | Plaintext ou sensitive                                         | Variable                                                                  |
| `FACEBOOK_CLIENT_TOKEN`                                                  | `.env`, somente se habilitado                                  | **Sensitive**, disponível à resolução da config                | Secret                                                                    |
| `ANDROID_EXPECTED_UPLOAD_CERT_SHA256`                                    | `.env`, certificado **upload** confirmado na Play              | Metadado de conferência; EAS gerencia assinatura separadamente | Variable, obrigatória no release GitHub                                   |
| `ANDROID_KEYSTORE_PATH`                                                  | Arquivo local protegido, ignorado                              | Credenciais Android gerenciadas pelo EAS                       | Não usado pelo workflow                                                   |
| `ANDROID_KEYSTORE_BASE64`                                                | Não necessário com arquivo local                               | Não duplicar automaticamente                                   | Secret, upload keystore correto codificado em base64                      |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | `.env` privado                                                 | Sistema de credenciais Android                                 | Secrets; senha da chave é opcional quando igual à do keystore             |

O Client Token Meta entra no binário e **não é App Secret**. Colocá-lo em EAS Secret, sem alternativa local, pode fazer a avaliação da config desabilitar Facebook; sensitive evita essa divergência. O App Secret Meta fica apenas na configuração do provider Firebase. Service account Play é outra credencial, necessária somente para EAS Submit automatizado, não para Firebase Auth ou assinatura do AAB.

## Passos do usuário, sem enviar segredos ao chat

### A. Conferir o projeto e os providers

1. No **Firebase Console**, selecione o projeto atual e confira o app Android com package `com.pedrorbc.HomeCare`.
2. Confira **Authentication → Sign-in method**: Google, Facebook e email/senha, preservando os providers necessários às contas existentes.
3. Confira **Firestore Database → Rules** contra `firestore.rules`. Se houver diferença, planeje validação e deploy separadamente; este trabalho não implanta regras.
4. Confirme o projeto no `.env` local. O valor inicial foi extraído do arquivo existente, **não confirmado independentemente na console**.
5. Defina `FACEBOOK_ENABLED=true` ou `false`. Com `true`, forneça App ID e Client Token válidos fora do Git. Não desabilite acesso de contas exclusivamente Facebook.

### B. Substituir a API key cliente que esteve no Git

1. Abra **Google Cloud Console → APIs & Services → Credentials**, no **mesmo projeto Firebase**.
2. Localize a API key cliente atual e revise suas restrições/serviços. Crie uma substituta nesse mesmo projeto; não gere service account/Admin por engano.
3. Revise/preserve a allowlist de APIs Firebase compatível com a chave atual e replique as restrições necessárias na substituta; não libere todas as APIs Google nem reduza a lista às cegas a Auth/Firestore. Chaves provisionadas pelo Firebase já recebem uma allowlist. Avalie separadamente application restrictions para Android com package e certificados legítimos (Play app signing, upload/APK direto e debug quando aplicável); valide a compatibilidade com os endpoints/SDKs usados antes de restringir clientes existentes. Não alterar a chave antiga durante essa preparação.
4. Atualize a cópia local ignorada de `google-services.json` para usar a API key substituta no `api_key.current_key` do cliente Android correto. Um novo download Firebase pode continuar selecionando a chave antiga: **confira qual chave o arquivo contém**, sem mostrá-la no chat. Não alterar project ID, app ID, package ou OAuth para outro projeto.
5. Preserve o arquivo anterior protegido para rollback. Execute `bun run config:check`. Esse check confirma estrutura/coerência, **não se a chave está ativa ou tem permissões remotas corretas**.
6. Atualize a variável file Secret EAS e o secret GitHub com o novo arquivo, depois valide o app assinado: Google, email/senha, Facebook via Firebase, renovação de sessão e acesso aos dados de teste. A build aceita antes da rotação não comprova esse resultado. Só retire a antiga após avaliar as instalações anteriores e autorizar a revogação; versões já instaladas continuam com a chave antiga e podem perder acesso se ela for excluída.

Não enviar a chave em texto ou screenshot no chat. Inserir a substituta diretamente no arquivo local ignorado e protegido, ou usar um canal privado apropriado. Trocar somente a API key no mesmo projeto não migra usuários, não altera UIDs nem requer trocar as chaves de criptografia. A chave nova também estará no APK; a rotação elimina o uso futuro da chave antiga, mas não transforma configuração cliente em segredo.

Identificadores OAuth/Meta e certificados são públicos e não são senhas. Não recrie o app/projeto para “rotacioná-los”. Outros segredos só precisam de rotação aqui se sua exposição for confirmada.

### C. Conferir Play e assinatura

1. No **Play Console → App integrity → App signing**, consulte separadamente os certificados **app signing** e **upload** da aplicação já enviada ao teste interno.
2. Preserve a app signing key. Recupere a upload key correta do EAS/backup, sem enviar keystore ou senha ao chat.
3. Defina `ANDROID_EXPECTED_UPLOAD_CERT_SHA256` com o certificado **upload**, confirmado na Play. O script rejeita um keystore válido porém diferente antes de compilar.
4. Registre SHA-1/SHA-256 legítimos no Firebase; no Meta, cadastre o key hash correto: SHA-1 **binário** codificado em Base64. Instalações Play usam app signing; APK direto usa o certificado que o assinou. Internal testing não é Internal App Sharing.
5. Confira o maior `versionCode` enviado e coordene com o contador remoto EAS/entrada GitHub. O contador do workflow não prova que o Play aceitará o envio.
6. Reset de upload key somente em caso de perda/comprometimento confirmado, na aplicação existente e pelo fluxo oficial. Não substituir a chave por uma recém-gerada sem a aprovação do reset.

### D. Sincronizar os ambientes

- EAS Dashboard → projeto existente → Environment variables: atualize o file Secret com o JSON novo e preencha as referências/expectativas da tabela, para cada environment usado. Não sobrescreva variáveis sem confirmar o destino.
- GitHub → Settings → Environments → `android-release`: configure variables e secrets da tabela. Para o JSON, uma alternativa sem imprimir o conteúdo é `gh secret set GOOGLE_SERVICES_JSON --repo PedroRBC/HomeCare --env android-release < google-services.json`.
- Não coloque senha/token literal em argumentos de CLI, pois podem aparecer no histórico/listagem de processos. Faça imports por arquivo/stdin ou console privado.
- Valores Secret não podem ser lidos de volta; nome/tipo/visibilidade corretos não comprovam igualdade. A confirmação final depende do consumidor/build.

## Comandos e fronteiras de teste

```bash
# Configuração real local, com .env privado (não imprime valores)
bun run config:check

# Arquivos rastreados e padrões selecionados de credenciais privadas
bun run security:check

# Configuração sintética, sem backend real nem secrets de release
GOOGLE_SERVICES_JSON=./scripts/fixtures/firebase-ci.json \
  GOOGLE_WEB_CLIENT_ID= FACEBOOK_ENABLED=false \
  FACEBOOK_APP_ID= FACEBOOK_CLIENT_TOKEN= \
  node scripts/verify-build-config.mjs --mode demo
```

O CI usa o projeto sintético `demo-homecare-ci` para doctor/prebuild/APK e smoke de navegação. Ele não fornece login real, não se conecta automaticamente a um emulador local e não valida configuração produtiva. Builds locais/EAS com o JSON real continuam usando o backend selecionado; o profile `preview` não o transforma em sandbox.

EAS Android roda o verificador **antes da instalação/prebuild**; `FIREBASE_EXPECTED_PROJECT_ID` e `FACEBOOK_ENABLED` são obrigatórios, e configuração demo é recusada em release. A avaliação preliminar local continua aceitando o Web ID válido quando o file Secret remoto não está disponível. EAS local builds precisam de arquivos/variáveis locais, não recebem automaticamente segredos remotos.

`submit.production` está preparado para a faixa **internal**, mas nada é enviado por esses checks. Uma atualização pelo teste interno deve preservar instalação, UID, acesso e leitura dos dados. Use conta/dispositivo de teste; não desinstale o app existente para contornar erro de assinatura, pois isso pode apagar dados locais.

### Validação local desta preparação

- 183 testes unitários passaram; os testes Google/Facebook usam configuração isolada, não o JSON real. Também passaram numa extração da árvore preparada para commit sem `.env`, JSON real ou backups locais.
- 91 testes de helpers, lint, typecheck e compatibilidade de dependências passaram, incluindo regressões de ordem das API keys e certificado incorreto no build local.
- Expo Doctor: 18/18 checks; prebuild Android concluído com a fixture sintética. Houve somente o aviso de ícone de notificação Android, sem falha no prebuild.
- `security:check` passou após incluir os arquivos novos no índice; cobertura limitada aos caminhos e padrões documentados, não certificação completa de segredos.
- Actionlint 1.7.12, ShellCheck 0.11.0 e Zizmor 1.30.1 offline passaram. Zizmor não reportou novos achados (7 ignorados e 5 suprimidos pela configuração existente). Os binários temporários foram conferidos por SHA-256; não foram adicionados ao repo.
- Na preparação inicial de 2026-10-11, o check de configuração real bloqueava a release por ausência de `FACEBOOK_ENABLED`. Na sincronização de 2026-10-15, a configuração local com Facebook habilitado passou. A identidade Firebase inicial ainda precisa de confirmação independente na console.
- Testes de regras em emuladores não foram executados localmente: a toolchain disponível tem Java 17, enquanto o CI utiliza Java 21. Não houve build APK/AAB, smoke em dispositivo nem teste OAuth real nesta preparação; os jobs correspondentes continuam no CI, e testes de login/assinatura dependem das etapas de console acima.

## Histórico e futura abertura

Excluir o arquivo no próximo commit **não elimina as versões antigas**. Antes de abrir o repo:

- confirmar substituição/retirada do material exposto e auditoria de todos os lugares relevantes;
- revisar artefatos, logs e outros clones/forks;
- decidir separadamente se deseja remover também a configuração cliente do histórico;
- planejar eventual `git-filter-repo`, referências de PRs e clones, sem force-push automático.

Não foi reescrito o histórico, não foi alterada a visibilidade do repo e não foi revogada credencial por esta preparação.

### Referências oficiais

- [Firebase API keys e restrições](https://firebase.google.com/docs/projects/api-keys)
- [EAS variáveis e Secret files](https://docs.expo.dev/eas/environment-variables/manage/)
- [EAS resolução local e visibilidades](https://docs.expo.dev/eas/environment-variables/usage/)
- [Ordem dos hooks Android](https://docs.expo.dev/build-reference/npm-hooks/)
- [Play app signing e upload reset](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Remover dados do histórico GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
