# Auditoria e correção das declarações Google Play

**Data:** 2026-10-18

App existente: **Home Care**, `com.pedrorbc.HomeCare`. Inicialmente havia **10/11 tarefas concluídas**, mas várias respostas não correspondiam ao projeto. A auditoria abaixo distingue leitura, correção salva, validação limitada e pendências. **Nenhuma alteração foi enviada para análise e nenhuma faixa foi lançada.**

## Resultado das dez tarefas antigas

| Tarefa | Antes | Revisão e estado atual |
| --- | --- | --- |
| Política de privacidade | URL `/privacy`, que retornava404 | Corrigida e salva para `https://pedrorbc.com/homecare/privacy`, fornecida pelo proprietário e acessível publicamente. App também passou a usar essa URL. O conteúdo público ainda precisa explicitar FCM/token e dados técnicos/país aproximado dos SDKs, alinhando-se ao texto interno atualizado. Nenhum deploy do site foi feito. |
| Detalhes do login | “Nenhuma parte é restrita” | Corrigido para **Sim, existe acesso restrito**. Conta/casa dedicadas e sintéticas criadas no Firebase real com autorização, por SDK cliente/regras normais. O proprietário confirmou o link; `emailVerified` foi conferido como verdadeiro antes do salvamento. Credenciais foram inseridas somente nos campos privados e instruções em inglês; entrada e salvamento conferidos sem expor valores. Ver [roteiro](review-access.md). |
| Anúncios | “Não tem anúncios” | Mantida: não há implementação de exibição de anúncios, e o proprietário confirmou o escopo. Isso não responde automaticamente à declaração separada de Advertising ID; veja abaixo. |
| Classificação de conteúdo | Questionário IARC de26/09/2025 | Consultado o resumo existente: categoria “Todos os Outros Tipos de Aplicativo”; Brasil/ClassInd **Livre**, ESRB Livre, PEGI3, USK todas as idades, IARC/Rússia/Coreia3. Não foi iniciado/submetido novo questionário nem aceita novamente a IARC. O conteúdo administrativo não demonstra, por si só, necessidade de outra classificação; 18+ de público-alvo é uma definição distinta. As respostas individuais antigas não foram integralmente recuperadas nessa tela: confirmar mudanças que afetem o questionário antes do envio. |
| Público-alvo | Somente18+, com restrição a menores determinada pelo Google | Conferido e mantido; o proprietário confirmou que o produto é para adultos. Não foi adicionada alegação de verificação etária dentro do app. |
| Segurança dos dados | **Não coleta/compartilha dados** | **Refeita e salva**, reconhecendo coleta em12 tipos/8 categorias e finalidades, conforme detalhamento abaixo. Conferida a prévia final, os opcionais, TLS e URL de exclusão. Ficou na fila de mudanças, sem envio para revisão. |
| Apps governamentais | Não desenvolvido por governo ou em seu nome | Mantida após comparação com o app e confirmação do proprietário de que é independente do governo. |
| Recursos financeiros | “Não oferece recursos financeiros” | Mantida no sentido das categorias de **serviço financeiro**: o proprietário confirmou que não há banco, carteira, empréstimos, investimentos ou transferência/processamento de pagamentos. Os registros manuais financeiros foram incluídos na Segurança dos dados. |
| Apps de saúde | “Meu app não tem recursos de saúde” | **Corrigida com autorização específica** para apenas **Serviços e gerenciamento de saúde**. A definição oficial inclui apoio a idosos/logística de cuidados; ausência de diagnóstico não equivale a ausência de recurso de saúde. Não declarados dispositivo médico, diagnóstico, medicação ou Health Connect. Etapa regional informou não haver exigência de documentos de dispositivo médico nessa seleção. Salvamento confirmado. A descrição da loja e a política interna explicitam que o app não é dispositivo médico. |
| Categoria e contato | App de **Finanças**; tarefa concluída | Com autorização do proprietário, categoria alterada e salva para **Produtividade**. Email de suporte confere com o contato público do app; telefone e site estavam vazios. Marketing externo preexistente foi preservado, sem inferir que corresponda à presença de anúncios dentro do app. |

**Ficha da loja, antes incompleta:** nome preservado “Home Care”, descrições pt-BR, ícone512×512, gráfico1024×500 e cinco capturas **reais** do Android1080×1920 foram salvos e reabertos. A ficha passou a **Pronta para revisão**, não enviada. Apenas o gráfico criado com assistência de IA foi rotulado individualmente; screenshots reais não foram declaradas como imagens geradas. Fontes e arquivos estão neste diretório.

## Segurança dos dados: respostas salvas

- **Coleta:** Sim. A criptografia de alguns campos não remove a obrigação de declarar coleta. Não foi alegada criptografia ponta a ponta.
- **Em trânsito:** Sim, TLS.
- **Criação de conta:** nome de usuário/senha e OAuth (Google e Facebook quando habilitado). Nenhuma promessa de inexistência de conta.
- **Excluir conta/dados:** `https://pedrorbc.com/homecare/data-deletion`.
- **Excluir seletivamente sem encerrar a conta:** **Não**. A página pública consultada descreve exclusão de conta; não foi prometido um serviço parcial inexistente nem exclusão automática em90dias. Isso não desativa a exclusão de registros que o app já permite por suas próprias telas.
- **Processamento efêmero:** não para os tipos declarados: há persistência no Firebase ou nos serviços correspondentes.
- **Selos:** não alegados auditoria independente nem pagamentos UPI verificados. Testes do projeto não são certificação independente.

| Tipo declarado | Obrigatório ou opcional | Finalidades |
| --- | --- | --- |
| Nome | Opcional | Funcionalidade, gerenciamento de contas |
| Email | Opcional | Funcionalidade, gerenciamento de contas |
| IDs de usuários | Obrigatório | Funcionalidade, gerenciamento de contas, análise e segurança/prevenção de fraudes |
| Outras informações financeiras | Opcional | Funcionalidade — valores e registros manuais de pagamentos de cuidadores, sem dados bancários/cartões |
| Local aproximado | Obrigatório para os serviços operacionais usados | Funcionalidade e análise — país/estimativas por SDK/IP, não GPS/localização exata |
| Fotos | Opcional | Funcionalidade e gerenciamento de contas — foto/URL de perfil fornecida por login social, sem inventar um upload de galeria |
| Eventos da agenda | Opcional | Funcionalidade — escalas/plantões registrados, não leitura do calendário Android |
| Registros de falhas | Opcional | Análise, mediante consentimento de Crashlytics |
| Diagnóstico | Opcional | Análise, mediante consentimento correspondente |
| Interações no app | Opcional | Análise, mediante consentimento de Analytics |
| Outro conteúdo gerado pelo usuário | Opcional | Funcionalidade — textos de casas/relatos voluntários |
| Identificadores do dispositivo e outros IDs | Obrigatório para serviços operacionais usados | Funcionalidade, análise e segurança — tokens/instalação/SDKs; nem todo identificador depende do consentimento de Analytics |

Nome/email/foto podem ser opcionais conforme método de login e recursos escolhidos; a ausência de email no Facebook já é suportada. A indicação “obrigatório” de IDs/local aproximado não ativa Analytics ou Crashlytics sem consentimento: os serviços operacionais também processam identificadores e contexto técnico. Não foram declarados localização exata, contatos do aparelho, SMS, microfone, prontuário ou dados clínicos sem evidência de coleta.

**Compartilhamento:** a prévia ficou “dados não compartilhados com terceiros”, no sentido específico do formulário, considerando as exceções de processadores atuando em nome do desenvolvedor e transferências explicitamente iniciadas pelo usuário (como convites/exportações). Isso **não** significa que Firebase/Google/Meta ou membros convidados não tratem dados; a política interna descreve os destinatários. Recursos publicitários estão desligados no código/configuração atuais. Não foi auditada toda configuração administrativa de compartilhamento da propriedade Analytics; alterações futuras desses serviços ou uso independente por SDKs exigem reavaliar essa resposta.

**Escopo de versão:** estas respostas foram preparadas para o código atual/futura build corrigida. A versão27 ainda ativa em teste interno e qualquer outro artefato distribuído precisam ser conciliados antes de enviar/publicar as declarações. O formulário salvo não certifica tráfego de todas as versões antigas nem conformidade jurídica.

## Advertising ID: pendência que não foi ocultada

A declaração separada de ID de publicidade estava pendente. “Sem anúncios” não basta:

- APK29 anterior contém `com.google.android.gms.permission.AD_ID` e `ACCESS_ADSERVICES_*`, herdadas de SDKs.
- `app.config.ts` agora bloqueia essas permissões; ausência confirmada no APK de desenvolvimento reconstruído e no manifest mesclado release (configuração sintética), target36, backup desligado, não-debuggable.
- Isso não altera AAB29 antigo nem os bundles já ativos na Play. **Não foi salva uma declaração negativa para contradizer esses artefatos.** Escolher/reconstruir/inspecionar o novo AAB e conciliar as faixas antes de concluir essa declaração.

## Publicação e teste fechado

- Produção continuou inativa; painel exige **12 testadores por14dias contínuos**, com **0 participantes** na consulta.
- País Brasil e lista de testadores “Usuarios Internos” já estavam configurados no rascunho Alpha; não foram criados convites nem alterados países/listas.
- Maior código mostrado na lista de pacotes recentes: **27/2.5.0**, ativo em teste interno. AAB29 anterior foi localizado localmente, mas não foi enviado.
- Rascunho de versão Alpha estava sem bundle selecionado e sem nome de versão. A marcação de etapa “criar versão” não comprova um release distribuível.
- Nova build assinada, revisão final das declarações/artefatos, autorização de envio, teste fechado real e posterior solicitação de produção continuam necessários. Nenhum contador, chave, regra de backend ou instalação existente foi substituído.

## Evidências e referências

- Código: `app.config.ts`, `firebase.json`, `src/context/AuthContext.tsx`, `src/services/firestore.ts`, `src/services/firebase.ts`, `src/services/pushNotificationService.ts`, `src/services/appUpdateService.ts`, `src/screens/PrivacyPolicyScreen.tsx` e `docs/privacy-and-security.md`.
- [Segurança dos dados: definições e exceções](https://support.google.com/googleplay/android-developer/answer/10787469?hl=pt-BR)
- [Divulgação dos SDKs Firebase](https://firebase.google.com/docs/android/play-data-disclosure)
- [Google Analytics e coleta automática, inclusive local aproximado](https://support.google.com/analytics/answer/11582702?hl=en)
- [Enquadramento de apps de saúde](https://support.google.com/googleplay/android-developer/answer/14738291?hl=pt-BR)
- [Teste fechado e acesso à produção](https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt-BR)
