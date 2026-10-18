# Acesso de revisão do Google Play

Esta conta dedicada foi criada em 18/10/2026 no projeto Firebase de produção associado ao app `com.pedrorbc.HomeCare`, usando autenticação de cliente e as regras Firestore normais. Os dados pertencem exclusivamente à nova conta e a uma casa sintética nova; nenhuma casa ou conta existente foi consultada, reutilizada ou alterada.

## Instruções ao revisor

1. Entre com o endereço e a senha fornecidos no formulário privado de acesso para revisão do Google Play.
2. Se o app apresentar escolhas de consentimento, selecione suas preferências normalmente. A conta não tem consentimentos de Analytics ou Crashlytics pré-selecionados.
3. Abra a casa de demonstração disponível para a conta. Ela contém uma cuidadora fictícia, sete dias de escala, um pagamento de demonstração e seu registro no histórico.
4. Explore casas, cuidadoras, calendário/escala, pagamentos e histórico. Os dados são exemplos descartáveis, sem relação com famílias, profissionais ou pagamentos reais.

## Limites e privacidade

- O proprietário confirmou o link do único e-mail de verificação enviado com autorização. A consulta autenticada ao Firebase confirmou **`emailVerified: true`** antes de salvar o acesso para revisão. Não houve alteração administrativa desse atributo nem bypass de review ou mudança nas regras.
- O Console foi corrigido para **“Sim, parte do app é restrita”**, com a conta dedicada, senha no campo privado e instruções em inglês. O salvamento foi confirmado pela entrada persistida e pelo botão Salvar desabilitado, sem envio para análise.
- Campos pessoais e financeiros de demonstração foram criptografados no cliente com uma chave exclusiva desta casa, usando o formato e o contexto de campo do app.
- Nenhuma regra, restrição do Firebase ou configuração administrativa foi alterada. A conta não recebeu privilégios de equipe, outras casas ou usuários.
- As credenciais ficam somente no arquivo local ignorado pelo Git `.secrets/play-review-credentials.json`, com diretório `0700` e arquivo `0600`. Não as inclua em commits, capturas, logs ou mensagens públicas; insira-as na Play Console somente pelo campo privado de acesso à revisão.
