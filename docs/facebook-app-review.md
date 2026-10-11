# Facebook: configuração e qualificação do HomeCare

## Escopo e evidências em 2026-10-11

Este documento prepara o cadastro, a qualificação e uma eventual revisão do **app Meta existente**. Não é comprovante de aprovação nem substitui as perguntas apresentadas no painel. Não criar outro app, mudar o Firebase, revogar credenciais, publicar builds ou ativar modo Live automaticamente.

A preparação de credenciais está na PR #49 e em [credentials-and-release.md](credentials-and-release.md). As alterações abaixo não modificam usuários, dados, regras implantadas ou chaves de criptografia das casas.

### Confirmado nesta continuação

- A configuração local da thread anterior foi trazida para esta worktree, com `.env` e `google-services.json` ignorados e protegidos com permissões `0600`.
- A atribuição duplicada de `FACEBOOK_ENABLED` foi removida; preservou-se a intenção de habilitar Facebook, sem certificar o provider remoto.
- O App ID anterior passa na validação sintática. Seu vínculo com o app Meta/Firebase ainda precisa ser conferido no painel.
- O valor anterior de `FACEBOOK_CLIENT_TOKEN` era um placeholder rejeitado pelo próprio resolver. O campo local foi deixado vazio: **a configuração real continua bloqueada até fornecer o token correto**.
- A URL referenciada no aplicativo, `https://pedrorbc.com/privacy`, retornou **HTTP 404** nesta verificação. Não usá-la como evidência de política pública disponível.
- O código solicita somente `public_profile` e `email`, não usa o SDK Meta para publicidade e desativa inicialização, eventos automáticos e coleta de advertiser ID.

### Não confirmado

Não há acesso autenticado ao painel Meta nesta sessão. O navegador disponível redirecionou para login e apresentou falhas de carregamento; nenhum MCP Facebook foi exposto. Não foram conferidos modo do app, papéis, permissões aprovadas, qualificação, verificação de empresa, redirects, hashes cadastrados ou credenciais remotas. Nenhum formulário foi enviado.

## 1. Completar o `.env` privado

1. No app Meta correto, localize **Configurações do app → Avançado → Token do cliente**; os nomes podem variar no painel atual.
2. Cole o valor diretamente em `FACEBOOK_CLIENT_TOKEN` no `.env` da worktree usada pelo build. Não cole no chat, issues, PRs, screenshots ou argumentos de comandos.
3. Confira se `FACEBOOK_APP_ID` identifica o mesmo app configurado no provider Facebook do Firebase. O App ID é público, mas deve ser coerente.
4. Preserve `FACEBOOK_ENABLED=true` se contas existentes dependem desse login. Não passe para `false` apenas para contornar o check.
5. Execute, nessa worktree:

   ```bash
   bun run config:check
   bun run security:check
   ```

O **Client Token não é App Secret nem token de usuário**. O Client Token entra no binário nativo; o App Secret fica somente no provider Firebase, nunca no cliente. O check confirma configuração local/estrutura, não a validade do token na Meta nem a aprovação do app.

Não se coloca `FACEBOOK_CLIENT_TOKEN` em `EXPO_PUBLIC_*` ou em `extra`. Ele já é consumido pelo plugin nativo em `app.config.ts`. Alterar `.env` não atualiza um APK instalado: será necessário um rebuild assinado, autorizado separadamente.

## 2. Cadastro e URLs públicas

- [ ] Abrir o app Meta existente e confirmar nome HomeCare, App ID, responsável e email de contato operacional.
- [ ] Conferir ícone, categoria, domínio e plataforma Android conforme os campos realmente exigidos.
- [ ] Publicar uma política de privacidade pública, HTTPS e acessível sem login. Corrigir `/privacy` no site ou definir uma URL efetiva e alinhar o aplicativo.
- [ ] Revisar a política pública contra `src/screens/PrivacyPolicyScreen.tsx`: login Facebook opcional, identidade básica/email opcional, Firebase, finalidade, compartilhamento, retenção, exclusão e contato.
- [ ] Revisar dados do controlador, transferências internacionais e retenções efetivamente configuradas. Não declarar prazo de backup ou conformidade legal sem confirmação.
- [ ] Publicar instruções públicas de exclusão. Há um [rascunho](public/homecare-data-deletion.md), **não uma página publicada**.
- [ ] Se o painel aceitar instruções de exclusão, selecionar essa opção e cadastrar a URL publicada. **Não cadastrar uma página estática no campo de callback**: não existe endpoint de exclusão Meta implementado neste projeto.
- [ ] Abrir as URLs sem sessão e verificar conteúdo, HTTP 200 e identificação explícita do HomeCare; uma página genérica do desenvolvedor não basta como evidência do conteúdo.

Publicar Markdown neste repositório, atualmente privado, não produz uma URL pública adequada. Hospedagem e publicação do site são uma etapa externa, não realizadas por esta preparação.

Se o texto da política no app mudar, atualizar `PRIVACY_POLICY_VERSION` conforme [privacy-and-security.md](privacy-and-security.md), para solicitar novo aceite. Não alterar o texto apenas para aparentar aprovação.

## 3. Firebase, Android e certificados

- [ ] Em Firebase Authentication, conferir se Facebook está habilitado e se usa o mesmo App ID/Secret do app Meta existente. Não copiar o Secret para `.env`, EAS ou GitHub.
- [ ] Copiar a URI de redirecionamento **mostrada pelo próprio Firebase** para as URIs OAuth válidas no Meta. Não inventar a URI a partir de outro projeto.
- [ ] Conferir plataforma Android, package `com.pedrorbc.HomeCare` e activity de entrada do APK/prebuild efetivamente usado.
- [ ] Cadastrar key hashes para os certificados de teste necessários e para o **app signing certificate** distribuído pelo Google Play.
- [ ] Não confundir upload key com Play app signing, nem internal testing com Internal App Sharing. APK direto e instalação Play podem exigir hashes distintos.

O hash Meta Android corresponde ao SHA-1 **binário** do certificado codificado em Base64, não ao fingerprint SHA-1 hexadecimal codificado como texto. Use certificados públicos para derivá-lo, sem enviar keystore, senhas ou chaves privadas.

Esta etapa foca Android. iOS não está qualificado por estes checks: requer configuração Firebase/plist e build próprio, além da revisão de requisitos de login da Apple descrita em `CONTRIBUTING.md`.

## 4. Qualificação, acesso e revisão no painel

1. Abra o caso de uso de login Facebook e as pendências de qualificação do app existente.
2. Confira o nível de acesso de **cada** permissão solicitada (`public_profile`, `email`) e as condições para usuários sem papel no app. Não assumir que Standard Access, modo Live ou uma permissão aprovada libera todas as outras.
3. Solicite somente o acesso necessário. O código não pede amigos, páginas, anúncios, Instagram ou WhatsApp.
4. Se o painel exigir App Review, acesso avançado, business verification ou outra verificação, registre o requisito exato e resolva-o na conta correta. Não certificar uma empresa inexistente nem inventar documentos.
5. Responder perguntas sobre operador/controlador, prestadores de serviço, transferências, pedidos de autoridades e práticas de segurança exige confirmação do responsável e do estado implantado. **Código local não comprova esses fatos**.
6. Prepare o material abaixo e revise antes de enviar. Envio da revisão e mudança para Live exigem autorização específica; esta preparação não os executa.

Em desenvolvimento, use pessoas com papéis de teste aceitos no painel, ou o mecanismo de contas de teste permitido naquele caso de uso. Não reutilize contas/dados reais de cuidadores ou compartilhe senha pessoal. Não afirmar suporte a contas de teste que o painel não oferece.

## 5. Textos para revisão — rascunhos baseados no código

Ajustar ao campo e ao limite exibido pela Meta. Estes textos não declaram conclusão de testes, publicação ou aprovação.

### Descrição do caso de uso

> HomeCare is an Android application for organizing households, caregivers, work schedules and payment records. Facebook Login is an optional authentication method, alongside email/password and Google. Users choose Facebook to authenticate with Firebase Authentication and access their own HomeCare account. HomeCare does not publish to Facebook or request access to friends, pages or advertising data.

### `public_profile`

> We use Facebook's basic identity returned during an explicit login to authenticate the user with Firebase Authentication and associate that login with a HomeCare account. The provider may supply a display name and profile picture. This permission is not used for advertising, posting, contact harvesting or sharing household, caregiver, schedule or payment records with Meta.

### `email`

> When Facebook returns an email address, Firebase Authentication and HomeCare may use it as account identity information and for account-related features. An email can be unavailable; the login flow handles that case without requiring the user to grant additional Facebook permissions. Email-dependent invitations and access grants require the application's own email/verification checks. We do not use this permission for marketing lists or advertising.

### Exclusão e dados

> Users can request account deletion in HomeCare under Settings → Privacy and Data → Delete account and data, with reauthentication using an available linked sign-in method, including Facebook. The flow deletes the HomeCare identity and profile, owned households and their associated data, and removes the user's access to households owned by other people. Records maintained by other household owners are not represented as deleted by this flow. Public deletion instructions must be supplied through a published instructions URL; this project does not implement a Meta data-deletion callback.

## 6. Roteiro e gravação para o revisor

Antes de gravar, confirmar qual mecanismo de distribuição/acesso a Meta aceita. Uma faixa interna Play privada não garante que o revisor tenha acesso. Fornecer a versão/build e instruções suficientes sem expor credenciais no repositório.

1. Instalar o build Android assinado com a configuração Facebook válida. Não usar Expo Go, smoke sintético ou APK que não inclua o SDK configurado.
2. Abrir a tela de login e selecionar o botão Facebook; mostrar a navegação real de autorização e retorno ao HomeCare.
3. Demonstrar consentimento e entrada na conta. Se criar dados de exemplo, usar somente dados fictícios e uma conta exclusiva para revisão.
4. Sair e entrar novamente, mostrando continuidade da mesma conta. Testar cancelamento e ausência de email separadamente.
5. Se a conta já usa outro método, abrir a gestão de conta no perfil e demonstrar vinculação autenticada, sem criar uma conta paralela por engano.
6. Abrir **Configurações → Privacidade e Dados**; mostrar exportação e o caminho de exclusão.
7. Demonstrar exclusão completa somente com uma conta descartável de teste e autorização para essa ação destrutiva; não excluir a conta do responsável ou dados compartilhados reais. Mostrar reautenticação e confirmação final.

A gravação precisa evidenciar o uso das permissões realmente solicitadas. Não mostrar tokens, Secrets, `.env`, dados pessoais reais, notificações privadas ou telas administrativas com credenciais. Revisar o arquivo antes de enviá-lo à Meta.

## 7. Critérios de conclusão e próximos passos

- [ ] Token real inserido localmente; `config:check` passa sem imprimir valores.
- [ ] App ID/provider/redirect/hashes conferidos na Meta, Firebase e Play.
- [ ] Política e instruções de exclusão publicadas e testadas sem login.
- [ ] Respostas de qualificação revisadas pelo responsável, com evidências remotas.
- [ ] Build assinado e teste OAuth real concluídos; não inferir pelo CI.
- [ ] Material de revisão acessível, sanitizado e revisado.
- [ ] Quando necessário, envio autorizado e resultado de revisão verificado.
- [ ] Facebook/local/EAS/GitHub sincronizados nos destinos confirmados, conforme a matriz de credenciais. Esta continuação não sincronizou valores remotos.

Até cumprir esses itens, não marcar o login público, a qualificação ou a aprovação como concluídos.

## Referências

- [Meta: App Review](https://developers.facebook.com/docs/facebook-login/review/)
- [Meta: instruções/callback de exclusão](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/)
- [Firebase: Facebook Login no Android](https://firebase.google.com/docs/auth/android/facebook-login)

A página geral de App Review foi consultada; ela não estabelece todas as condições atuais de `public_profile`/`email` ou verificação de empresa. Os demais links são referências operacionais; seus requisitos devem ser conferidos no painel e na documentação acessível, sem assumir que foram todos verificados nesta sessão.
