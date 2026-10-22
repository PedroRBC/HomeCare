# Candidata 3.0.3 (34): validação bloqueada

**Estado em 22/10/2026: NÃO PUBLICAR e NÃO EXIGIR por Remote Config.** O AAB compila e os testes unitários passam, mas a validação nativa ainda falha.

## Escopo

- Versão local preparada: `3.0.3`, `versionCode=34`. Conferir o maior código já usado na Play antes de qualquer envio; nenhum contador EAS/Play foi alterado.
- Código atual de `master`, incluindo login/vinculação Facebook pausados, aviso de atualização e persistência do aceite das políticas.
- Ajustes adicionais testados: evitar pedido automático repetido após recusa das notificações e manter o host nativo da navegação com `collapsable={false}` durante o carregamento.
- Nenhum deploy de regras, publicação de configuração remota, envio à Play Store ou merge foi realizado nesta preparação.

## Build

A compilação local usou o checkout atual, configuração Firebase de produção existente, a mesma upload key e caches preservados. O preflight de assinatura e a verificação de assinatura do AAB passaram. O APK universal foi derivado desse AAB com bundletool oficial 1.18.3, não reconstruído a partir de outro checkout.

Artefato final avaliado: AAB SHA-256 `c37b8a7b57e2cff16099015e11012656df5785c6b61b4749a240fa015d0f1b6b`. Package `com.pedrorbc.HomeCare`, versão `3.0.3`, código `34`, target API 36, min API 24; APK sem DEBUGGABLE, assinatura e `zipalign -c -P 16 4` verificados. A assinatura de upload não certifica o comportamento da assinatura de distribuição Play.

**Os artefatos reprovados foram retirados de `reports/android-release/` e isolados em `reports/release-3.0.3/blocked-native-validation/`.** Não reutilizar builds intermediárias de `rejected-*/`.

## Teste real no Android

Dispositivo: AVD `HomeCare_Key29_20261017`, serial `emulator-5556`, Android 15/API 35, x86_64, 1080×2400. Foi testado o APK release real, sem Expo Go ou Metro, porque o objetivo específico era verificar o candidato de produção. Atualização instalada com `adb install -r`, sem limpar armazenamento ou desinstalar.

Foi usada somente a conta sintética dedicada à revisão. O aceite obrigatório havia sido autorizado pelo usuário nessa conta; Analytics e Crashlytics permaneceram desligados. Não foram editados dados de casas, cuidadoras, escalas ou pagamentos.

### Resultados

1. Primeira build: falha fatal Fabric `Unable to find viewState for tag 28` na transição do carregamento. O log tentava inserir o host da navegação sem sua criação no lote nativo.
2. Repetição de pedidos de notificação: localizada em inicialização local/foreground e inicialização push. Os dois caminhos agora não solicitam automaticamente após status `denied`; os botões explícitos Ativar permanecem disponíveis. Regressões observadas falhando antes das alterações.
3. Apenas o ajuste de permissões não eliminou a falha Fabric. Depois de fixar o host com `collapsable={false}`, três partidas frias do processo passaram, exibindo calendário e dados de produção da casa sintética, sem repetir login/aceite.
4. Ao tentar navegar para cuidadoras, o processo sofreu **SIGSEGV**, em `libart.so` / `JNI::SetByteArrayRegion` / `SocketInputStream_socketRead0`, na thread `OkHttpClientTransport` do gRPC. Não foi um erro JavaScript de permissão Firestore.
5. Repetido o mesmo APK após boot completo do AVD com `-no-snapshot-load -no-snapshot-save`, preservando dados: novamente três partidas passaram e o SIGSEGV se repetiu. Portanto não foi comprovado que o problema fosse apenas um snapshot antigo do emulador.
6. A sequência completa cuidadoras/pagamentos/histórico/retorno ao foreground **não passou** para esta candidata. As verificações bem-sucedidas anteriores da versão 3.0.2 não foram transferidas como aprovação desta build.

Logs, capturas e scripts locais estão em `reports/release-3.0.3/`, ignorado pelo Git. O AVD iniciado nesta tarefa foi encerrado, preservando os dados.

## Verificações de código

- 308 testes unitários / 57 arquivos passaram na execução final.
- 20 testes dos helpers de release/configuração passaram.
- TypeScript, ESLint, Prettier com exclusão do estado local gerado `.gstack/`, checagem de segredos e `git diff --check` passaram durante a preparação.
- Revisão independente identificou o segundo caminho de pedido automático de push; ele foi ajustado e recebeu regressão própria.
- **Objeção de revisão ainda pendente:** no Android, `expo-notifications` pode informar `denied` com `canAskAgain=true` em uma instalação nova, antes do primeiro pedido. A guarda por `status === "undetermined"` pode fazer a primeira solicitação depender do botão Ativar. A política desejada e o caso real de primeira instalação precisam ser resolvidos antes de aprovar a release; não considerar os testes atuais uma certificação desse cenário.

## Antes de liberar

1. Diagnosticar/corrigir o SIGSEGV e repetir o fluxo completo, incluindo um dispositivo físico/ARM64 ou outra imagem Android para delimitar o alcance. Não atribuir ao emulador sem evidência comparativa.
2. Resolver o comportamento de primeira solicitação Android, sem reintroduzir o ciclo após recusa; validar instalação nova e atualização com permissão concedida/recusada.
3. Gerar novamente o AAB final e repetir assinatura, testes nativos e conferência do versionCode.
4. Publicar a versão adequada na Play Store e confirmar disponibilidade para todo o público afetado.
5. Só então considerar `minimum_android_version=3.0.3`, `latest_android_version=3.0.3` e `force_update_android=true`, com o link correto da loja. Não ativar esses valores para esta candidata reprovada. Aplicativos antigos sem esse fluxo ou sem acesso ao Remote Config não podem ser obrigados remotamente por esse mecanismo.
