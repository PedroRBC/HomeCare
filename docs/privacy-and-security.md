# Privacidade e segurança (LGPD)

## Criptografia

| Onde | Como |
| --- | --- |
| Transporte | Todo acesso ao Firebase usa TLS. Campos sensíveis já saem do aparelho cifrados. |
| Repouso (servidor) | Campos sensíveis são cifrados no app com **AES-256-GCM** antes de gravar. |
| Repouso (aparelho) | Cache do Firestore guarda os campos cifrados; `allowBackup: false` no Android. |

- Campos cifrados: `SECURE_FIELDS` em `src/utils/secureFields.ts` (nomes e valores de cuidadores e do histórico de pagamentos).
- Formato: `enc:v1:<base64(nonce | ciphertext | tag)>`. O AAD é `caminho/do/documento#campo`, então um valor copiado para outro lugar não decifra.
- Chave: uma por casa, em `house_keys/{houseId}`, legível só por membros (`firestore.rules`). Gerada junto com a casa ou, em casas antigas, pelo primeiro membro que abre a casa (transação).
- Dados antigos em texto puro continuam legíveis e são recifrados automaticamente na primeira leitura.
- Excluir uma casa apaga a chave: cópias cifradas guardadas sem ela (caches de aparelhos, exportações parciais) ficam ilegíveis. Um backup completo do banco feito antes da exclusão também contém a chave e só some ao fim da retenção desse backup.

Para cifrar um novo campo, adicione-o em `SECURE_FIELDS` e use `encryptFields`/`decryptFields` em `src/services/firestore.ts`.

## Controle de acesso

`firestore.rules` restringe cada usuário ao próprio perfil e às casas das quais participa. A participação é o registro `user_house_access/{houseId}_{userId}`, criado com a casa ou a partir de um convite pendente para o email do usuário.

Cuidadoras com email cadastrado têm um vínculo em `caregiver_links/{houseId}__{caregiverId}` (nome, email, nome da casa e plantões, em claro, pois ela não tem a chave da casa). Ao aceitar, o app grava `caregiver_access/{houseId}_{uid}` apontando para o vínculo; as regras só liberam a leitura da escala enquanto esse vínculo existir, for dela e estiver aceito. Outras casas só leem vínculos aceitos (para checar disponibilidade).

Testes das regras (precisam do emulador do Firestore):

```bash
firebase emulators:exec --only firestore "bun test src/security"
```

## Consentimento e direitos do titular

- `src/utils/privacy.ts` guarda a versão da Política/Termos. **Ao alterar os textos, atualize `PRIVACY_POLICY_VERSION`/`TERMS_VERSION`**: todos os usuários verão a tela de consentimento de novo.
- Analytics e Crashlytics começam desligados (`firebase.json`) e só são ativados com consentimento, revogável em Configurações › Privacidade e Dados.
- Parâmetros de analytics passam por `sanitizeAnalyticsParams`, que remove nomes, emails, valores e mensagens.
- Privacidade e Dados oferece: exportação completa em JSON, correção de perfil, revogação de consentimentos e exclusão da conta (com senha ou Google).
