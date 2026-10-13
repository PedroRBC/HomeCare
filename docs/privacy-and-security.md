# Privacidade e segurança (LGPD)

## Criptografia

| Onde               | Como                                                                            |
| ------------------ | ------------------------------------------------------------------------------- |
| Transporte         | Todo acesso ao Firebase usa TLS. Campos sensíveis já saem do aparelho cifrados. |
| Repouso (servidor) | Campos sensíveis são cifrados no app com **AES-256-GCM** antes de gravar.       |
| Repouso (aparelho) | Cache do Firestore guarda os campos cifrados; `allowBackup: false` no Android.  |

- Campos cifrados: `SECURE_FIELDS` em `src/utils/secureFields.ts` (nomes e valores de cuidadores e do histórico de pagamentos).
- Formato: `enc:v1:<base64(nonce | ciphertext | tag)>`. O AAD é `caminho/do/documento#campo`, então um valor copiado para outro lugar não decifra.
- Chave: uma por casa, em `house_keys/{houseId}`, legível só por membros (`firestore.rules`). Gerada junto com a casa ou, em casas antigas, pelo primeiro membro que abre a casa (transação).
- Dados antigos em texto puro continuam legíveis e são recifrados automaticamente na primeira leitura.
- Excluir uma casa apaga a chave do banco ativo. Isso protege somente cópias guardadas sem a chave; o cache completo do Firestore pode guardar dados e chaves juntos. Um backup completo feito antes da exclusão também contém a chave e segue a retenção do provedor.
- As chaves ficam no mesmo banco dos dados. A criptografia complementa as regras de acesso; não impede administradores do projeto de decifrar dados, nem apaga cópias/chaves que um membro já tenha obtido. Revogação de acesso não equivale a rotação de chave ou destruição retroativa dessas cópias.
- Registros sensíveis novos precisam começar com ao menos um campo cifrado; criar um documento vazio e depois preencher campos em texto puro é recusado. Depois que um campo foi cifrado, as regras rejeitam sua substituição por texto puro. Isso não substitui o planejamento da transição: versões antigas, registros legados, convites e acessos existentes precisam ser tratados antes de habilitar a migração para todos.

Para cifrar um novo campo, adicione-o em `SECURE_FIELDS` e use `encryptFields`/`decryptFields` em `src/services/firestore.ts`.

## Controle de acesso

`firestore.rules` restringe cada usuário ao próprio perfil e às casas das quais participa. A participação é o registro `user_house_access/{houseId}_{userId}`, criado com a casa ou a partir de um convite pendente para o email do usuário.

Cuidadoras com email **verificado** têm um vínculo em `caregiver_links/{houseId}__{caregiverId}` (nome, email, nome da casa e plantões, em claro, pois ela não tem a chave da casa). Ao aceitar, o app grava `caregiver_access/{houseId}_{uid}` apontando para o vínculo; as regras só liberam a leitura da escala enquanto esse vínculo existir, corresponder ao email verificado e estiver aceito. Outras casas não podem enumerar esses registros; disponibilidade entre casas permanece desconhecida até existir uma consulta mínima explicitamente autorizada.

Testes das regras, serviços e migração (precisam dos emuladores Auth e Firestore):

```bash
bunx firebase-tools@15.30.2 emulators:exec --project demo-homecare-rules --only auth,firestore "bun run test:rules"
```

## Consentimento e direitos do titular

- `src/utils/privacy.ts` guarda a versão da Política/Termos. **Ao alterar os textos, atualize `PRIVACY_POLICY_VERSION`/`TERMS_VERSION`**: todos os usuários verão a tela de consentimento de novo.
- Analytics e Crashlytics começam desligados (`firebase.json`) e só são ativados com consentimento, revogável em Configurações › Privacidade e Dados.
- Parâmetros de analytics passam por `sanitizeAnalyticsParams`, que remove nomes, emails, valores e mensagens.
- Privacidade e Dados oferece: exportação completa em JSON, correção de perfil, revogação de consentimentos e exclusão da conta (com senha ou qualquer provedor social vinculado e disponível).
- Exportação e exclusão também permanecem acessíveis quando o usuário não aceita uma nova versão dos termos. Dados indecifráveis são sinalizados como indisponíveis; não viram valores financeiros válidos de zero.
- Se registros antigos de acesso não puderem ser lidos, as casas válidas continuam disponíveis e a exportação identifica explicitamente os registros ausentes. Dados de casas próprias não alcançáveis bloqueiam a exclusão antes de qualquer escrita destrutiva; um acesso apenas de gerente a uma casa confirmadamente inexistente pode ser removido.
- Revogações são aplicadas no aparelho antes do registro remoto. Se o registro falhar, a revogação local é mantida por conta e revisões impedem que uma confirmação antiga apague uma revogação mais recente.
- O login opcional com Facebook recebe da Meta somente a identidade básica retornada pelo provedor, como nome e email (o email pode faltar). Nenhum dado de casas, cuidadores, escalas ou pagamentos é compartilhado com a Meta. O SDK não é usado para publicidade nem analytics automático.
- A integração Facebook exige configuração pública do app Meta (política de privacidade e URL de exclusão de dados) e papéis/modo Live para produção. Não há webhook de exclusão de dados implementado; a exclusão da conta continua sendo executada pelo fluxo autenticado do HomeCare.
- As gravações remotas também são ordenadas por conta, incluindo a consulta do ticket e a retomada de revogações ao entrar. Uma retomada antiga não pode terminar depois de uma escolha nova e sobrescrevê-la; gravações de sessões encerradas são recusadas. Uma conta com gravação pendente não bloqueia outra conta.

## Feedback e suporte

- Feedbacks e relatos de problemas são enviados voluntariamente e ficam em `feedback_reports`, separados dos dados das casas e do consentimento para Analytics/Crashlytics. O texto não usa a chave AES da casa: é protegido por TLS, armazenamento do Firebase e regras de acesso. Não devem conter dados médicos, de pacientes, senhas ou logs.
- O usuário acessa apenas seus próprios relatos. A equipe autorizada em `staff_access/{uid}` pode ler todos e alterar somente status/link de issue; usuários e equipe não podem conceder acesso por clientes. Ser gerente/dono de casa ou definir um campo no perfil não concede acesso ao suporte.
- Relatos entram na exportação e são apagados durante a exclusão da conta, antes da remoção da identidade Auth. Falhas interrompem a conclusão da exclusão. A equipe também pode excluir relatos com confirmação.
- O visualizador Vite usa cache de dados somente em memória e autenticação da sessão; limpa dados ao sair ou perder autorização. Não existem chamadas automáticas de IA/GitHub. A cópia para chat tem revisão/edição obrigatória para remover informações pessoais; texto livre não é anonimizado automaticamente.
- Não há TTL/rotina de retenção automática nesta versão. A equipe deve definir e executar limpeza periódica de relatos desnecessários e tratar pedidos de remoção. Cópias externas em chat/issues têm retenção própria, não controlada pela exclusão da conta.
- Limites de tamanho/consulta e proteção contra toques duplicados não equivalem a uma defesa robusta contra abuso. App Check/limites em servidor são trabalho futuro caso o volume exija.
- Configuração e hospedagem posterior em Vercel: [Feedback reporting](feedback-reporting.md). O hostname não substitui as regras de autorização.

## Migração local

O comando `bun run migrate:local` inventaria todas as casas e oferece dry-run, backup, conversão e verificação, inclusive para casas ainda não abertas no app. Só aceita projetos `demo-*` em emuladores locais. Veja [o plano de migração](data-migration.md) para os modos apply/verify, correção de registros, import/export e retomada após falha.
