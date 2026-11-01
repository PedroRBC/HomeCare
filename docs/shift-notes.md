# Notas do turno — issue #93

## Uso

- Família/gerentes: Calendário → dia → **Notas do turno · Dia/Noite**.
- Cuidador: **Meus Plantões** → linha de um plantão → **Notas do turno**.
- Recados e passagens compartilham a linha do tempo do turno. Não existe chat fora da escala.
- A passagem é sugerida, não obrigatória. Apenas um cuidador aceito, ativo e escalado pode criá-la ou editar sua própria passagem.
- O último turno **escalado** anterior é encontrado na escala real, ignorando intervalos vazios. Todas as passagens registradas naquele turno aparecem automaticamente, inclusive se a escala for corrigida depois e o autor deixar de constar nela. Se não houver passagem, o app informa isso; não substitui silenciosamente por uma nota antiga.
- As pendências têm IDs estáveis, texto e estado `open`/`done`. O cuidador escalado no turno seguinte pode atualizar o estado sem reescrever o texto clínico. O progresso é exibido como concluídas/total.
- **Decisão registrada:** as regras permitem que qualquer cuidador ativo escalado em um turno **posterior** à passagem resolva suas pendências, não apenas o do turno imediatamente seguinte. Assim, uma pendência que atravessa vários turnos pode ser concluída por quem de fato a executar. É mais permissivo que o mínimo da issue, mas não amplia acesso: exige vínculo aceito/ativo, email verificado e atribuição real no turno informado.
- Um registro ilegível (payload corrompido, chave errada) ou uma seção que falha ao carregar gera um aviso explícito com opção de tentar de novo, **apenas naquela seção**. Recados, passagens e pendências válidos continuam visíveis e acionáveis.
- Autores editam/excluem o próprio conteúdo; gerentes podem excluir recados. Exclusão pede confirmação. Revisões/transações impedem sobrescrita silenciosa em edição ou resolução concorrente.
- Escritas exigem conexão. Falhas preservam o texto; conflito pede cancelar a edição e abrir a versão atual. Sair da tela ou trocar o tipo de nota descarta o rascunho local; não há rascunhos persistentes nesta versão.

## Modelo e referência à escala

Uma única coleção por casa: `houses/{houseId}/shiftNotes/{noteId}`.

| Campo | Uso |
| --- | --- |
| `kind` | `handover` ou `message` |
| `shiftKey` | `YYYY-MM-DD:day/night`, ordenável pela ordem real do turno |
| `scheduleRef` | `DocumentReference` para o documento existente `houses/{houseId}/schedule/{YYYY-MM-DD}` |
| `authorUid` | Conta autenticada do autor, imutável |
| `caregiverId` | Cuidador autor da passagem, validado contra vínculo e escala; `null` em recados |
| `payload` | JSON cifrado, incluindo nome de exibição do autor e todo texto livre |
| `pendingStatus` | Mapa de ID da pendência para `open`/`done`; apenas estados, sem texto clínico |
| `resolvedFrom` | Turno escalado de onde veio a última resolução de pendências |
| `resolvedByCaregiverId` | Vínculo de cuidador usado na última resolução, validado pelas regras |
| `revision` | Contador de edições para detectar concorrência |
| `generation` | Identificador aleatório e imutável da criação. Apagar e recriar a passagem (mesmo ID determinístico) gera nova geração, então um editor com referência antiga recebe conflito em vez de sobrescrever ou apagar a nova |
| `createdAt`, `updatedAt`, `updatedBy` | Metadados de autoria/atualização; datas do servidor |

A passagem usa ID determinístico por turno/conta e criação transacional. Recados usam IDs aleatórios. Não há cópia ou migração da escala para outro módulo.

### Consulta anterior e índices

Primeiro, a escala da casa identifica o último turno ocupado anterior. A consulta na subcoleção da **mesma casa** usa o turno estável, não a atribuição mutável: `kind == handover`, `shiftKey >= turnoAnterior`, `shiftKey < turnoAtual`, `orderBy(shiftKey, desc)`. A ordem vem do `shiftKey` cronológico, nunca da data de criação da nota.

Vínculo usado na escrita: quando a mesma conta tem mais de um vínculo aceito na casa, UI, serviço e regras usam o **mesmo** vínculo — o que está ativo e escalado no turno — em vez do ponteiro genérico de acesso à casa. As regras validam que esse vínculo pertence ao email verificado da conta.

`firestore.indexes.json` contém o índice composto `kind + shiftKey DESC` (consulta anterior) e o índice de grupo por `authorUid` para exportação/exclusão. A linha do tempo do turno usa só igualdades e dispensa índice composto. O emulador não comprova a disponibilidade de índices em produção: publique-os e aguarde o estado **Enabled** antes de liberar o cliente.

## Acesso e criptografia

- **Recados:** membros da casa e cuidadores com email verificado, vínculo aceito e ativo. Chave exclusiva em `shift_note_keys/{houseId}`.
- **Passagens clínicas:** apenas cuidadores com vínculo aceito e ativo. Família/gerentes sem esse vínculo não podem ler documentos clínicos nem sua chave, mesmo consultando diretamente o Firestore. Chave exclusiva em `shift_handover_keys/{houseId}`.
- Uma pessoa que é simultaneamente gerente e cuidador só recebe acesso clínico por seu vínculo de cuidador, nunca pelo papel de gerente.
- As chaves de comunicação não são a chave financeira da casa. Cuidadores continuam sem acesso a pagamentos de terceiros.
- AES-256-GCM reutiliza `fieldCrypto`; AAD vincula o payload a `${documentPath}:payload`. Os textos de pendências são cifrados, não só as observações.
- As regras verificam tipo, campos permitidos, vínculo, email verificado, atribuição real, referência de escala, enum de estados, revisão e timestamps. Apenas o autor edita o texto. A resolução por outro cuidador só altera estados e metadados, conservando os IDs dos itens.
- As chaves também ficam no Firebase: isto não é criptografia ponta a ponta contra o operador do serviço. Cache do SDK, chaves ou exportações já obtidas não são apagados retroativamente por revogação. A política de privacidade explica essas limitações e foi atualizada para `2026-10-31`, exigindo novo aceite.

## Exportação e exclusão

- A exportação das casas inclui **somente recados**; não amplia o acesso clínico de gerentes.
- O bloco pessoal `shiftNotes` inclui notas do próprio autor, inclusive depois de sair da casa. Sem acesso à chave, identifica o registro com `readable: false` e entrega seu payload cifrado, sem compartilhar a chave de terceiros.
- Exclusão da conta apaga as notas próprias antes de remover vínculos/identidade Auth, por consulta de grupo restrita a `authorUid`. Exportação e exclusão próprias usam leitura **autoritativa do servidor** (`getDocsFromServer`), paginada, conferindo que a sessão continua sendo do mesmo usuário — no padrão de `deleteOwnReports`. Cache local ou falha de conexão no meio do processo resultam em erro explícito, nunca em exportação parcial apresentada como completa ou em exclusão incompleta reportada como concluída; uma nova tentativa termina o restante.
- Exclusão da casa remove ambas as chaves no fluxo existente. As regras só permitem excluir `shift_note_keys` e `shift_handover_keys` **na mesma escrita atômica que exclui a casa**; o dono não pode destruir a chave clínica isoladamente e inutilizar passagens de outros autores. Como família não pode enumerar passagens clínicas, a função confiável `cleanupHouseShiftNotes` elimina a subcoleção após a exclusão da casa. É idempotente e configurada para novas tentativas. Não concede leitura clínica ao cliente para conseguir fazer limpeza.

## Implantação obrigatória, sem deploy automático neste PR

1. Instalar dependências do backend: `bun install --cwd functions --frozen-lockfile`.
2. Publicar a função `cleanupHouseShiftNotes` do codebase `shift-notes`, as regras e os índices no projeto correto. O backend usa Node 22 e requer a infraestrutura/billing de Cloud Functions do projeto.
3. Aguardar os índices ficarem disponíveis e verificar o gatilho de exclusão antes de distribuir o cliente. Não distribuir sem esse backend: notas de casas excluídas poderiam ficar órfãs.
4. Publicar o cliente. Não é necessária migração de dados existentes.

Exemplo, **apenas para operação autorizada após revisão**:

```sh
bunx firebase-tools@15.30.2 deploy --project SEU_PROJETO --only functions:shift-notes,firestore:rules,firestore:indexes
```

Nenhum deploy nem escrita em serviços produtivos foi feito durante a implementação.

## Verificação

```sh
bun install --frozen-lockfile
bun install --cwd functions --frozen-lockfile
bun run test
bun run lint
bun run typecheck
bun run test:ci-helpers
# Java 21+ para o emulador; JDK 17 para o build Android do projeto.
bunx firebase-tools@15.30.2 emulators:exec --project demo-homecare-rules --only auth,firestore "REQUIRE_FIRESTORE_EMULATOR=1 REQUIRE_AUTH_EMULATOR=1 bun run test:rules"
```

Os testes de integração substituem apenas o bridge nativo por Firebase Web SDK e executam os serviços reais contra o emulador e as regras de produção. Cobrem CRUD cifrado, referência real, isolamento família/clínico, revogação, exportação/exclusão, payload adulterado, concorrência e resolução de pendências. A limpeza de casa é testada com Admin SDK no emulador. O CI instala e testa também esse backend.

### Teste manual recomendado para QA

1. Em projeto `demo-*` com Auth/Firestore locais, cadastrar uma família e dois cuidadores com emails verificados. Convidar e aceitar os vínculos; escalar o primeiro de dia e o segundo de noite.
2. Na conta da família, enviar um recado pelo calendário; editar e excluir com confirmação. Confirmar que não há editor nem conteúdo clínico.
3. No primeiro cuidador, abrir a linha do plantão em Meus Plantões. Conferir o recado, responder e salvar checklist, duas pendências e observações.
4. No segundo, abrir o turno seguinte: a passagem anterior deve aparecer sem busca manual. Concluir um item e conferir o progresso e a atualização no outro dispositivo.
5. Tentar editar a mesma nota em dois dispositivos. A segunda alteração deve sinalizar conflito e manter o texto digitado.
6. Remover/recusar/desativar o vínculo e conferir bloqueio de leitura compartilhada e das chaves. Testar família tentando ler passagens diretamente no emulador.
7. Conferir exportação, exclusão própria e limpeza de uma casa com dados sintéticos; não executar essas ações em dados produtivos.

### Evidência local

Development build reconstruído e instalado sem limpar dados, no **HomeCare_PayVisual_20261030 / emulator-5556, Android 15**. Configuração Firebase sintética `demo-homecare-ci`, Auth/Firestore locais e Metro do checkout atual. Validado: entrada pela escala da família, gravação de recado, entrada por Meus Plantões, checklist clínico, criação de item pendente, gravação cifrada, passagem automática para o turno seguinte e conclusão com progresso `0/1 → 1/1`. A conta sintética começou apenas como família e depois recebeu vínculo de cuidador; os testes de integração usam contas distintas para provar o isolamento. Rolagem e entrada de texto foram exercitadas com o controlador nativo. Não foi uma sessão de testes com usuários reais, nem validação iOS.

## Limitações conhecidas

- **Push de recados/passagens fica para v2**, conforme permitido no escopo de revisão. As atualizações em tela são em tempo real pelo Firestore; isso não é notificação push em segundo plano. O app ainda não tem entrega confiável entre dispositivos para esse tipo de evento, e nenhum texto clínico é enviado a notificações.
- Não há anexos, confirmações de leitura, edição por terceiros ou rascunhos persistentes.
- Revisões: GPT‑6 Luna (exclusão clínica por gerentes) e, depois, Ada (Tech Lead) e Rigel (QA). Os achados foram corrigidos com testes que primeiro falharam e depois passaram. A aprovação de revisão não autoriza merge.
- O lint adicional de workflows não roda localmente por falta de ShellCheck; permanece no CI.
