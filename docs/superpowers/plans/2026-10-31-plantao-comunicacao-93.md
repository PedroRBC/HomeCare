# Notas do turno — issue #93

**Goal:** Entregar passagem estruturada e recados vinculados à escala existente, em um PR sem merge.
**Spec:** https://github.com/PedroRBC/HomeCare/issues/93
**Architecture:** Coleção unificada `houses/{houseId}/shiftNotes` com referência ao documento real da escala, autor e tipo. Textos cifrados com chaves separadas para recados e passagens clínicas; nunca compartilhar a chave financeira com cuidadores nem a chave clínica com família. Tela comum nas duas escalas. Passagem sugerida, não obrigatória.
**Tech Stack:** React Native/Expo, React Navigation, React Native Firebase, AES-GCM existente, Bun; Cloud Function apenas para limpeza confiável de casas excluídas.

## Restrições

- Preservar alterações locais em graphify-out, dados existentes e caches.
- Nenhuma escrita de teste em produção; validação com development build Android e Firebase sintético.
- Apenas autor edita/exclui a própria passagem; membros da casa moderam por exclusão somente recados.
- Cuidador só escreve passagem quando vinculado, aceito, ativo e escalado. Família não acessa passagens ou sua chave.
- Pendências são itens com IDs estáveis e estado open/done, resolvíveis no turno seguinte sem modificar o texto de outro autor.
- Consulta anterior por casa, cuidador e ordem do turno, com índice composto versionado.
- Push pode ficar para v2, conforme autorização posterior do usuário; documentar expressamente.

## Review focus

- Troca de casa/turno/conta não mantém conteúdo de outro contexto.
- Concorrência sinaliza conflito, sem sobrescrever silenciosamente.
- Passagem anterior é do último turno escalado anterior, incluindo virada de mês e dias sem escala.
- Falha de rede/criptografia aparece e preserva o texto digitado.
- Exportação e exclusão incluem o conteúdo novo sem ampliar acesso clínico.

## Execução e resultado

- [x] Domínio: payloads limitados, pendências estruturadas e seleção cronológica; testes red/green.
- [x] Persistência: chaves separadas, listeners, CRUD transacional, regras e testes em emuladores.
- [x] UI: checklist, pendências/progresso, observações, recados, confirmação de exclusão e erros; integrar ambas as escalas e pt/en/es.
- [x] Privacidade: exportação e exclusão próprias; limpeza confiável de casa; política atualizada com novo aceite.
- [x] Revisão: duas leituras independentes GPT‑6 Luna, achado de exclusão clínica verificado e corrigido com regressão nas regras e UI.
- [x] Validar lint, tipos, unidades, segurança e Android; registrar comandos adicionais interrompidos/bloqueados sem afirmar que passaram.

Detalhes de implantação, testes, evidência Android e limitações: [Notas do turno](../../shift-notes.md). A entrega deve ser um único PR com `Closes #93`; não fazer merge.
