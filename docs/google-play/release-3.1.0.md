# HomeCare 3.1.0 — preparação para Google Play

## Versão e base

- `versionName`: **3.1.0**; `versionCode` local: **35**.
- Package preservado: `com.pedrorbc.HomeCare`.
- Base: última preparação de versão mesclada, **3.0.2 / 33**, PR [#74](https://github.com/pedrorbc/homecare/pull/74), merge `bf8831f0aae1bf6d34cd6b0c17df20d85fa6c66d`.
- Conteúdo: `master` em `35273a052592226a85f60c1a81c32b77ffca6903`, mais os metadados e as notas desta preparação.
- O código **34** identifica a candidata 3.0.3 não mesclada do PR [#79](https://github.com/pedrorbc/homecare/pull/79). Suas alterações não foram incluídas. O código 35 evita reutilizar esse identificador local; o maior código enviado à Play ainda precisa ser conferido na Console.
- Não foi confirmada pela Play Console a versão efetivamente publicada. O intervalo abaixo usa o histórico Git e os PRs mesclados, não o estado da loja.

## PRs mesclados desde a preparação 3.0.2

Foram conferidos os **16 merges** no histórico de primeira linha entre a base e o conteúdo acima, com títulos e descrições consultados pelo GitHub.

| PR | Mudança | Notas públicas |
| --- | --- | --- |
| [#75](https://github.com/pedrorbc/homecare/pull/75) | Mantém o aceite dos termos e da política entre atualizações; preserva verificações de mudança de política. | Sim |
| [#76](https://github.com/pedrorbc/homecare/pull/76) | Desativa login e novas vinculações Facebook; adiciona avisos de atualização via Remote Config. | Sim |
| [#78](https://github.com/pedrorbc/homecare/pull/78) | Permite aproveitar a tela de tablets sem faixas de orientação retrato. | Sim |
| [#80](https://github.com/pedrorbc/homecare/pull/80) | Corrige salvamento de avatar sem alteração de nome e espaçamento no perfil. | Sim |
| [#82](https://github.com/pedrorbc/homecare/pull/82) | Cores por casa em Meus Plantões, inclusive dias compartilhados entre casas. | Sim |
| [#83](https://github.com/pedrorbc/homecare/pull/83) | Sete novas famílias de temas, cada uma com modo claro e escuro. | Sim |
| [#84](https://github.com/pedrorbc/homecare/pull/84) | Widgets Android de plantões e pagamentos; valores monetários opcionais. | Sim |
| [#77](https://github.com/pedrorbc/homecare/pull/77) | Modelo importável de Remote Config e documentação operacional. | Não: documentação |
| [#64](https://github.com/pedrorbc/homecare/pull/64) | Atualiza i18next. | Não: dependência |
| [#66](https://github.com/pedrorbc/homecare/pull/66) | Atualiza Zod. | Não: dependência |
| [#68](https://github.com/pedrorbc/homecare/pull/68) | Atualiza Prettier. | Não: ferramenta |
| [#67](https://github.com/pedrorbc/homecare/pull/67) | Atualiza baseline-browser-mapping. | Não: dependência |
| [#47](https://github.com/pedrorbc/homecare/pull/47) | Atualiza globals no grupo de lint. | Não: ferramenta |
| [#63](https://github.com/pedrorbc/homecare/pull/63) | Atualiza dependências de navegação. | Não: dependências |
| [#61](https://github.com/pedrorbc/homecare/pull/61) | Atualiza dependências de estilos. | Não: dependências |
| [#81](https://github.com/pedrorbc/homecare/pull/81) | Atualiza GitHub Actions. | Não: CI |

As notas prontas para colar estão em [release-notes.pt-BR.txt](release-notes.pt-BR.txt), com **382 caracteres** dentro do bloco pt-BR, abaixo do limite de 500.

## Artefato e verificações — 2026-10-27

- Build local nova com `bun run build:aab`, a upload key existente e a configuração Firebase real preservada. Caches Bun/Gradle/SDK mantidos, sem limpeza. `BUILD SUCCESSFUL in 7m 35s`.
- AAB: `reports/android-release/app-release.aab` (**84.572.345 bytes**, aproximadamente 80,65 MiB). Arquivo local ignorado; não incluído no Git nem enviado à Play.
- SHA-256: `f27c0e350d2d5693041be3b77cee74517d2d564be74c348e6c19c01f8aee1f35`.
- Assinatura conferida pelo build e novamente após sua conclusão contra o certificado de upload fixado. Package `com.pedrorbc.HomeCare`, versão **3.1.0 / 35**, `debuggable=false`, min SDK **24**, target SDK **36**, ABIs **arm64-v8a, armeabi-v7a, x86 e x86_64** confirmados no artefato.
- `bundletool validate` **1.18.3**, integridade de todas as entradas ZIP e presença do bundle JavaScript offline: passaram. O JAR oficial do bundletool foi conferido pelo digest SHA-256 publicado no GitHub antes do uso.
- Inspecionadas **52 bibliotecas ELF64** das ABIs arm64-v8a/x86_64: segmentos LOAD com alinhamento de pelo menos **16 KB** e congruência de offset/endereço. Isso não substitui execução em dispositivo 16 KB nem inspeção de alinhamento ZIP dos APKs gerados pela Play.
- TypeScript, ESLint/Prettier, **370 testes unitários em 61 arquivos**, **104 testes de scripts**, compatibilidade de dependências, configuração de produção, preflight do certificado e checagem de arquivos secretos: passaram. A checagem de segredos cobre apenas os nomes e padrões documentados, não uma auditoria exaustiva.
- `adb devices -l` não listou dispositivo ou emulador conectado. **Sem instalação, testes visuais, navegação, login, atualização pela Play ou verificação da falha nativa reportada no PR #79 nesta build.** Nenhum build de desenvolvimento foi reutilizado; somente o AAB de release foi compilado.
- Avisos de build: ícone de notificação não configurado no prebuild e APIs Gradle/dependências obsoletas. Não impediram a compilação; não foram corrigidos nesta preparação de versão.

## Cuidados antes de publicar

- A candidata 3.0.3 do PR #79 foi bloqueada por um SIGSEGV nativo durante navegação no emulador e por uma questão de permissões de notificação. Esta preparação não afirma corrigir esses problemas; validar a navegação e as permissões na build 3.1.0 antes de liberar para produção.
- Contas exclusivamente Facebook não conseguem iniciar nova sessão por esse método enquanto estiver desativado. Conferir alternativas de acesso antes da liberação.
- Avisos de atualização dependem de Remote Config. Publicar `latest_android_version=3.1.0` somente depois da disponibilidade para o público elegível, conforme [app-updates.md](app-updates.md). Não alterar a versão mínima obrigatória como efeito desta preparação.
- Não houve submissão à Play, alteração de contador remoto EAS, deploy de regras, mudança de credenciais ou escrita nos dados de produção.
