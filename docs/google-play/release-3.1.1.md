# HomeCare 3.1.1 — preparação para Google Play

## Versão e base

- `versionName`: **3.1.1**; `versionCode` local: **36**.
- Package preservado: `com.pedrorbc.HomeCare`.
- Base do changelog: preparação **3.1.0 / 35**, commit `d4c99d2`.
- Conteúdo: `master` em `fb8745358fe4c112b966bbfbf865af7442bbc631`, mais os metadados e as notas desta preparação.
- O intervalo usa o histórico Git, não o estado da Play Store. A disponibilidade da 3.1.0 e o maior código enviado à Play Console não foram conferidos nesta preparação.

## Changelog desde 3.1.0

### Novidades

- Previsão dos próximos pagamentos na tela **Meus Plantões** do cuidador, agrupada por mês, com totais mensais e filtro por casa.
- Detalhes de cada período de pagamento, incluindo plantões diurnos e noturnos e valores adicionais quando aplicáveis.

### Correções

- Widgets Android adaptados aos diferentes tamanhos disponíveis no launcher.
- Atualização dos widgets na mudança de dia local, com recuperação após mudanças de horário, fuso, reinicialização e atualização do app.
- O atalho de plantões de hoje resolve a data ao abrir, em vez de reutilizar uma data antiga do widget.
- Sincronização de pagamentos serializada, proteção contra gravações referentes a um e-mail de vínculo anterior e preservação das estimativas durante falhas transitórias de carregamento.

### Segurança e manutenção

- Reforço nas verificações dos provedores de autenticação.
- Melhorias na segurança das ferramentas de migração local, inspeção de arquivos secretos e configuração dos emuladores Firebase.
- README com visão geral do produto e capturas do app.

### PRs incluídos

- [#86](https://github.com/pedrorbc/homecare/pull/86): tamanhos responsivos dos widgets.
- [#87](https://github.com/pedrorbc/homecare/pull/87): documentação e capturas do app.
- [#89](https://github.com/pedrorbc/homecare/pull/89): previsões de pagamento para cuidadores e totais por mês.
- [#90](https://github.com/pedrorbc/homecare/pull/90): atualização diária dos widgets.
- [#91](https://github.com/pedrorbc/homecare/pull/91): correções de segurança identificadas pelo CodeQL.

As notas prontas para colar estão em [release-notes.pt-BR.txt](release-notes.pt-BR.txt), com **329 caracteres** dentro do bloco pt-BR, abaixo do limite de 500.

## Artefato e verificações — 2026-10-30

- Build local nova com `bun run build:aab`, usando a upload key e a configuração Firebase existentes, sem alterações nas credenciais. Caches Bun/Gradle/SDK preservados; nenhum comando de limpeza. **BUILD SUCCESSFUL in 7m 4s**.
- AAB: `reports/android-release/app-release.aab` (**84.579.462 bytes**, aproximadamente **80,66 MiB**). Arquivo local ignorado; não incluído no Git nem enviado à Play.
- SHA-256: `54faef8d9c7255b89fb07a256af9346bf317ac4e583f31399e4a7218dea8a71d`.
- Assinatura conferida pelo build e novamente após sua conclusão contra o certificado de upload fixado; checksum SHA-256 conferido.
- Manifesto do artefato: package `com.pedrorbc.HomeCare`, versão **3.1.1 / 36**, `debuggable=false`, min SDK **24**, target SDK **36**. ABIs: **arm64-v8a, armeabi-v7a, x86 e x86_64**.
- `bundletool validate` **1.18.3**, integridade de todas as entradas ZIP e presença do bundle JavaScript offline: passaram. Reutilizado o JAR local registrado na preparação 3.1.0, SHA-256 `a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29`.
- **52 bibliotecas ELF64** de arm64-v8a/x86_64 passaram na inspeção de segmentos LOAD: alinhamento de pelo menos **16 KB** e congruência de offset/endereço. Isso não substitui execução em dispositivo 16 KB nem inspeção de alinhamento ZIP dos APKs gerados pela Play.
- TypeScript, ESLint/Prettier, **392 testes unitários em 67 arquivos**, **109 testes de scripts**, compatibilidade de dependências, configuração de produção, preflight do certificado e checagem de arquivos secretos: passaram. A checagem de segredos cobre os nomes e padrões documentados, não uma auditoria exaustiva.
- `adb devices -l` listou **emulator-5554** e **emulator-5556**, mas nenhum foi usado nesta preparação de metadados. **Não foram realizados instalação, testes visuais, navegação, login, atualização pela Play ou validação funcional nesta candidata.** Nenhum build de desenvolvimento foi reutilizado ou reconstruído; somente o AAB de release foi compilado.
- Avisos não bloqueantes: ícone de notificação não configurado no prebuild, APIs Gradle/dependências obsoletas e mensagens de conexão de socket do daemon Gradle. A compilação e a validação do artefato terminaram com sucesso; esses avisos não foram corrigidos nesta preparação.

## Antes de publicar

- Conferir que o código **36** ainda está disponível na Play Console.
- Validar instalação, atualização, navegação, login, pagamentos do cuidador e widgets na candidata antes de liberar para produção.
- A preparação [3.1.0](release-3.1.0.md) registrou um SIGSEGV nativo e uma questão de permissões de notificação na candidata 3.0.3 do PR #79. Esta preparação não afirma corrigir esses problemas; navegação e permissões continuam exigindo validação na candidata.
- A previsão de pagamentos depende da sincronização dos dados pelo app de quem gerencia a casa. São estimativas dos plantões já cadastrados, não confirmação de pagamento.
- Publicar `latest_android_version=3.1.1` no Remote Config somente depois da disponibilidade para o público elegível, conforme [app-updates.md](app-updates.md). Não alterar a versão mínima obrigatória como efeito desta preparação.
- Esta preparação não autoriza submissão à Play, alteração do contador remoto EAS, deploy de regras, mudança de credenciais ou escrita nos dados de produção.
