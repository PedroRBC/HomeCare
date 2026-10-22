# Aviso de atualização do HomeCare

O app mostra um aviso quando o Firebase Remote Config informa uma versão Android mais recente que a versão instalada. **Não consulta a versão diretamente na Play Store e não instala atualizações silenciosamente.** O botão **Atualizar agora** abre a página do HomeCare na Play Store; a instalação depende da loja e da confirmação/configuração de atualização automática da pessoa.

## Primeira configuração: importar modelo de Cliente

Use **Remote Config de Cliente**, não de Servidor. O HomeCare usa `@react-native-firebase/remote-config` no aplicativo Android/iOS. O modelo de Servidor é independente e atende backends pelo Admin SDK; seus parâmetros não são entregues ao SDK do app.

Arquivo pronto para importação: [`remote-config-client.template.json`](remote-config-client.template.json). Baixe o arquivo JSON original, não a página HTML do GitHub.

1. Abra o projeto Firebase usado pela build e entre em **Remote Config → Cliente → Parâmetros**. A URL de Cliente termina em `/config`; a de Servidor contém `/config/env/firebase-server`.
2. Confirme que a configuração está vazia. Se houver parâmetros ou condições, exporte um backup e preserve-os antes de continuar: a publicação de um modelo substitui a configuração inteira.
3. No menu de três pontos, escolha **Publicar de um arquivo / Publish from a file**, selecione o JSON e aguarde a validação do Firebase.
4. Confira os valores importados e publique. A publicação afeta o app; não basta escolher o arquivo.

O modelo inicial usa versões **`0.0.0`**, `force_update_android=false`, `force_update_ios=false` e `maintenance_mode=false`. Assim não anuncia uma versão não confirmada nem bloqueia instalações existentes. O link Android já aponta para o HomeCare na Play Store. A mensagem de manutenção usa o padrão traduzido do app. **Após importar, configure `latest_android_version` com a versão realmente disponível para começar a anunciar atualizações.** Não habilite iOS sem configurar também sua URL da App Store.

Os valores booleanos têm tipo `BOOLEAN`, mas `defaultValue.value` usa as strings `"true"`/`"false"`, conforme o formato de templates do Firebase. Não coloque credenciais ou dados privados: parâmetros de Cliente podem ser lidos por quem usa o app.

Referência: [templates de Cliente e de Servidor](https://firebase.google.com/docs/remote-config/templates).

## Configurar após cada publicação

1. Publique a nova versão e confirme que ela já está disponível na Play Store para o público que receberá o aviso.
2. No **mesmo projeto Firebase usado pela build**, abra **Remote Config** e atualize os parâmetros abaixo.
3. Publique as alterações do Remote Config. Não basta salvar um rascunho.

Exemplo: para anunciar uma versão **3.0.3**, depois de sua liberação:

| Parâmetro | Tipo | Valor de exemplo |
| --- | --- | --- |
| `latest_android_version` | String | `3.0.3` |
| `minimum_android_version` | String | `3.0.0` |
| `force_update_android` | Boolean | `false` |
| `update_url_android` | String | `https://play.google.com/store/apps/details?id=com.pedrorbc.HomeCare` |
| `release_notes` | String | Texto opcional com as novidades |

Use versões numéricas como `3.0.3`, correspondentes ao **versionName**, não ao `versionCode`. O exemplo não representa uma versão já publicada.

Com essa configuração, uma instalação `3.0.2` recebe um aviso opcional, com **Atualizar agora** e **Mais tarde**. Instalações `3.0.3` ou superiores não recebem esse aviso. Se `update_url_android` estiver vazio, o app usa a mesma URL da Play Store automaticamente.

### Atualização obrigatória

Somente quando versões antigas realmente não puderem continuar: configure `minimum_android_version` com a menor versão suportada e `force_update_android=true`. A versão `latest_android_version` deve ser igual ou superior à mínima.

Instalações abaixo da mínima ficam bloqueadas pelo aviso, sem **Mais tarde**. Com `force_update_android=false`, o aviso continua opcional, mesmo abaixo da mínima. Nunca exija uma versão que ainda não esteja acessível na loja para todas as pessoas afetadas.

## Quando o aviso aparece

- Ao abrir o app e ao retornar de outro aplicativo, inclusive da Play Store.
- O Firebase mantém cache de até **uma hora** entre buscas em produção. Uma publicação no Remote Config pode não aparecer imediatamente.
- O aviso opcional aparece uma vez por versão durante a sessão. **Mais tarde** não volta a interromper a mesma sessão, mas o aviso pode aparecer ao reiniciar o processo do app.
- Avisos obrigatórios não têm opção de adiamento. O modo de manutenção tem prioridade sobre avisos de atualização.
- Sem rede, a busca tem timeout de dez segundos e o app tenta usar os valores já ativados em cache. Sem configuração de atualização disponível, não inventa uma versão nova nem bloqueia o uso normal.
- A build instalada precisa conter este fluxo; uma versão antiga não recebe mudanças JavaScript retroativamente sem uma nova instalação.

## Liberações graduais e testes

O Remote Config não confirma a elegibilidade individual de atualização na Play Store. Durante liberação gradual ou teste restrito, não anuncie globalmente uma versão que parte das pessoas ainda não pode instalar. Aguarde a disponibilidade para o público-alvo ou use condições adequadas no Firebase.

Valide em instalação Play de versão anterior: aviso, **Mais tarde**, retorno ao app, abertura da página da loja e atualização concluída. Confirme também o uso sem rede. O modo local com Firebase Emulators desativa avisos remotos por segurança; os testes unitários cobrem a decisão de versão e o ciclo de exibição, não uma instalação real pela Play.

## Facebook temporariamente desativado

Login e novas vinculações do Facebook ficam ocultos mesmo em builds com o SDK configurado. Google e email/senha continuam disponíveis. Contas, vínculos e sessões existentes não são apagados; a reautenticação Facebook para exclusão de contas existentes permanece disponível quando a build nativa a suporta.

Não remova as credenciais/plugins nativos apenas para ocultar os botões: isso poderia impedir a reautenticação de contas já vinculadas. Contas que dependam exclusivamente de Facebook não conseguem iniciar uma nova sessão por esse método enquanto o login estiver desativado; precisam de um método alternativo já vinculado ou recuperação/suporte apropriado. Não crie uma segunda conta para contornar a restrição.
