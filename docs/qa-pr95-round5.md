# PR #95 — quinta rodada: regressões de serviço e componente

Baseline: `327d8fc3dc2aa636e30da4ea2e4f4aba0a50dfaf`, branch `feature/plantao-comunicacao-93`.
Execução local em 01/11/2026, neste checkout pelo T3Code. Somente dados sintéticos e Firebase Auth/Firestore emuladores `demo-*`.

## Achados confirmados e correções

1. **Leitura transacional com apontador histórico desativado.** Os testes chamam `getNoteKey`, `ShiftNotesService.save`, `subscribe` e `resolve` reais. Depois de carregar a chave/nota, trocam apenas o apontador para um vínculo aceito desativado da mesma conta. Criação e resolução falharam antes com `permission-denied` no `get` da nota. Cada mutação clínica agora prepara acesso de novo: consulta vínculos próprios no servidor e revalida, em transação, vínculo explícito e vínculo do apontador atual. Mantém outro apontador ativo; repara o desativado antes da leitura da nota. A transação da nota continua revalidando o vínculo e as regras continuam exigindo escala/autorização. Nenhuma regra foi ampliada. Os controles cobrem vínculo inválido/desativado/não escalado, preservação de apontador ativo e mudança concorrente de apontador/vínculo entre consulta e transação. Apontador desconhecido ou acesso removido falha de forma conservadora e exige reabrir a tela; não se substitui autorização desconhecida.

2. **Passagem alheia ilegível bloqueia primeira criação.** A assinatura real descartava ID/autor do registro ilegível; o componente real bloqueava B antes de chamar save. Agora transporta o envelope `{id, authorUid}` junto da contagem. Após confirmação do servidor, B pode criar quando todos os ilegíveis são identificados como alheios. Próprio ID determinístico, autoria própria/desconhecida e metadados incompletos continuam bloqueando criação. O serviço real verifica a autoria ilegível, cria a passagem de B e a lê novamente; testes do componente verificam disponibilidade e `existing: undefined`. Edição de passagem própria legível, recados, cache e isolamento família continuam cobertos.

3. **Payload válido no schema excede o teto cifrado.** Criptografia real mediu 43.727 caracteres para barras invertidas e 75.727 para controles Unicode; o teto das regras continua 40.000. `NoteTooLargeError` rejeita o tamanho efetivamente cifrado antes de qualquer transação, inclusive preparação de acesso. A tela mostra orientação PT/EN/ES para reduzir observações/pendências e mantém o rascunho. Fronteira real: 39.999 aceita e persistida; próximo tamanho representável 40.007 rejeitado sem transação; escrita direta acima do teto rejeitada pelas regras. Payload Unicode com emoji é gravado e relido. A fronteira depende da serialização do payload, não só da soma de caracteres dos campos.

## Reprodução antes da correção

Apenas os testes haviam sido alterados; implementação ainda no baseline acima.

```sh
bun test src/screens/ShiftNotesScreen.test.ts
JAVA_HOME=/usr/lib/jvm/java-25-openjdk PATH=/usr/lib/jvm/java-25-openjdk/bin:$PATH bunx firebase-tools@15.30.2 emulators:exec --project demo-homecare-rules --only auth,firestore 'REQUIRE_FIRESTORE_EMULATOR=1 bun test --timeout 30000 --test-name-pattern "real creation repairs|real resolution repairs|explicit clinical operations|missing valid explicit|unreadable handover retains|schema-valid|real crypto and rules" src/security/shiftNotesService.test.ts'
```

Saída nominativa bruta (trechos):

```text
(fail) first handover creation distinguishes unreadable other authorship [1.07ms]
(fail) first handover creation distinguishes unreadable other authorship [1.07ms]
 36 pass
 1 fail
(fail) ShiftNotesService integration > real creation repairs a disabled historical pointer after the clinical key was loaded [562.01ms]
(fail) ShiftNotesService integration > real resolution repairs a pointer changed after another author's handover was loaded [301.86ms]
(pass) ShiftNotesService integration > explicit clinical operations preserve an existing active pointer for another link of the same account [143.84ms]
(pass) ShiftNotesService integration > missing valid explicit link cannot create or resolve clinical data [243.24ms]
(fail) ShiftNotesService integration > unreadable handover retains author identity so another assigned caregiver can create their first note [174.16ms]
Encrypted backslashes: 43727 characters; rules cap: 40000
(fail) ShiftNotesService integration > schema-valid backslashes exceeding encrypted budget are rejected before any transaction [110.21ms]
Encrypted escaped Unicode controls: 75727 characters; rules cap: 40000
(fail) ShiftNotesService integration > schema-valid escaped Unicode controls exceeding encrypted budget are rejected before any transaction [107.44ms]
Encrypted boundary: 39999 accepted, 40007 exceeds 40000
(fail) ShiftNotesService integration > real crypto and rules accept the encrypted boundary and Unicode without raising the server limit [209.03ms]
 2 pass
 6 fail
```

O teste de identidade falhou em `undefined` versus `[{ id: "2026-10-31:day__cg", authorUid: "cg" }]`; a criação direta de B ainda não havia sido chamada nessa execução. No componente, o botão estava desabilitado indevidamente. Os testes de tamanho falharam por `permission-denied` vindo da gravação, em vez da rejeição local tipada antes de transacionar. Controles de apontador ativo e ausência de vínculo válido já passavam.

## Verificação após a correção

O bridge nativo é adaptado para o SDK Firebase Web nos testes de integração. Serviço, criptografia AES-GCM/serialização, transações e regras de produção são reais; não são apenas `setDoc`/`updateDoc` diretos. Escritas administrativas com regras desabilitadas servem somente para preparar as fixtures/interleavings sintéticos.

```sh
bun test src/screens/ShiftNotesScreen.test.ts
bun run test
bun run lint
bun run typecheck
bun run security:check
JAVA_HOME=/usr/lib/jvm/java-25-openjdk PATH=/usr/lib/jvm/java-25-openjdk/bin:$PATH bunx firebase-tools@15.30.2 emulators:exec --project demo-homecare-rules --only auth,firestore 'REQUIRE_FIRESTORE_EMULATOR=1 REQUIRE_AUTH_EMULATOR=1 bun run test:rules'
git diff --check
```

Saída nominativa bruta da suíte completa de regras/integração:

```text
(pass) FirestoreService integration > accepting a historical invitation preserves active access [137.65ms]
(pass) FirestoreService integration > accepting a historical invitation preserves active access when the invited link is concurrently disabled [169.41ms]
(pass) FirestoreService integration > orphaned access pointer can recover a disabled accepted history without clinical access [157.11ms]
(pass) ShiftNotesService integration > real creation repairs a disabled historical pointer after the clinical key was loaded [86.06ms]
(pass) ShiftNotesService integration > real resolution repairs a pointer changed after another author's handover was loaded [131.79ms]
(pass) ShiftNotesService integration > explicit clinical operations preserve an existing active pointer for another link of the same account [85.96ms]
(pass) ShiftNotesService integration > clinical access revalidates a concurrent pointer/link change: preserve new active pointer [101.58ms]
(pass) ShiftNotesService integration > clinical access revalidates a concurrent pointer/link change: revoked explicit link [76.78ms]
(pass) ShiftNotesService integration > missing valid explicit link cannot create or resolve clinical data [125.47ms]
(pass) ShiftNotesService integration > unreadable handover retains author identity so another assigned caregiver can create their first note [127.52ms]
Encrypted backslashes: 43727 characters; rules cap: 40000
(pass) ShiftNotesService integration > schema-valid backslashes exceeding encrypted budget are rejected before any transaction [55.67ms]
Encrypted escaped Unicode controls: 75727 characters; rules cap: 40000
(pass) ShiftNotesService integration > schema-valid escaped Unicode controls exceeding encrypted budget are rejected before any transaction [57.76ms]
Encrypted boundary: 39999 accepted, 40007 exceeds 40000
(pass) ShiftNotesService integration > real crypto and rules accept the encrypted boundary and Unicode without raising the server limit [141.30ms]
(pass) ShiftNotesService integration > cached empty current handovers waits for server empty result [46.75ms]
(pass) ShiftNotesService integration > cached empty current handovers waits for server existing note [67.60ms]
(pass) ShiftNotesService integration > cached empty previous discovery waits for server empty result [57.42ms]
(pass) ShiftNotesService integration > cached empty previous discovery waits for server existing note [78.85ms]
(pass) ShiftNotesService integration > malformed communication key preserves own ciphertext alongside healthy clinical export [153.96ms]
(pass) ShiftNotesService integration > family/caregiver exchange messages; family export never includes clinical content [145.93ms]
(pass) ShiftNotesService integration > concurrent instruction resolution rejects an author's stale text edit [123.85ms]
 129 pass
 0 fail
Ran 129 tests across 7 files. [26.73s]
✔ deleting a house removes orphaned notes and keys, not another house (271.023182ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
ℹ skipped 0
✔  Script exited successfully (code 0)
```

Saída nominativa bruta do componente:

```text
(pass) family loads only the communication key and cannot see clinical editor or previous handovers [7.68ms]
(pass) current empty state waits for all applicable sections: pending [0.29ms]
(pass) current empty state waits for all applicable sections: failed [0.22ms]
(pass) current empty state waits for all applicable sections: unreadable [0.18ms]
(pass) current empty state waits for all applicable sections: empty [0.13ms]
(pass) an unreadable handover by another author does not block editing the readable own handover [0.43ms]
(pass) cached empty current and previous sections wait for server confirmed emptiness [1.96ms]
(pass) cached empty current and previous sections wait for server existing notes [0.42ms]
(pass) first handover creation distinguishes unreadable other authorship [0.54ms]
(pass) first handover creation distinguishes unreadable cg authorship [0.20ms]
(pass) first handover creation distinguishes unreadable unknown authorship [0.23ms]
(pass) encrypted size rejection gives actionable feedback and keeps the clinical draft for shortening and retry [0.70ms]
(pass) incomplete or inconsistent unreadable identity cannot authorize first creation: [] [0.26ms]
(pass) incomplete or inconsistent unreadable identity cannot authorize first creation: [{"id":"2026-10-31:night__cg","authorUid":"other"}] [0.12ms]
 40 pass
 0 fail
```

Outras saídas:

```text
[unit-tests] Passed 448 registered tests across 71 files
Checking formatting...
All matched files use Prettier code style!
$ tsc --noEmit && tsc --project reviewer/tsconfig.json --noEmit
```

Lint/typecheck retornaram 0. `git diff --check` retornou 0 sem saída. Verificação `security:check` passou; cobre nomes conhecidos e padrões selecionados, não constitui auditoria completa de segredos.

Foram adicionados 6 testes unitários de componente e 10 de serviço com emulador. Os controles das rodadas anteriores permaneceram na execução completa, incluindo cache, chaves legadas, resolução concorrente/não imediata, isolamento clínico, históricos e limpeza.

## Evidências e limites

Logs locais brutos: `/tmp/homecare-review5-screen-red.log`, `/tmp/homecare-review5-rules-red.log`, `/tmp/homecare-review5-screen-green.log`, `/tmp/homecare-review5-service-green.log`, `/tmp/homecare-review5-unit.log`, `/tmp/homecare-review5-rules-green.log`, `/tmp/homecare-review5-lint.log`, `/tmp/homecare-review5-typecheck.log`, `/tmp/homecare-review5-security.log`.

Esta rodada não executou percursos no app Android/iOS. Os dois percursos de interface do QA anterior continuam incompletos por bloqueio agent-device/daemon; iOS indisponível no Linux. As imagens em `reports/evidence/pr-95-shift-notes/README.md` pertencem a `13e2b7c`, não ao código desta rodada nem ao baseline `327d8fc`. Nenhuma captura antiga foi contada como evidência atual.

CI deve ser associado ao novo SHA publicado; o sucesso informado do baseline não foi reutilizado. Inventário completo skipped não equivale a passou. Esta evidência não declara aprovação de Ada/Rigel: ambas precisam de novo aceite explícito no mesmo HEAD. Sem merge, deploy ou escrita em produção. Alterações alheias em `graphify-out` preservadas.
