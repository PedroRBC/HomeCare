# Preparação da publicação Google Play

## Destino e limites

Aplicação existente: **Home Care**, package **`com.pedrorbc.HomeCare`**. A preparação preserva o projeto Firebase, as chaves e os UIDs existentes, o esquema de `house_keys`, a assinatura e o versionamento remoto. A criação de uma conta/casa sintética de revisão no Firebase real foi autorizada separadamente: gera apenas os novos documentos e a chave da nova casa, sem consultar ou modificar contas/casas existentes.

Em **18/10/2026**, o painel autenticado mostrou:

- App em rascunho e produção inativa.
- Configuração inicial: **10/11 tarefas concluídas**, faltando a ficha da loja.
- Teste fechado: **3/5 tarefas concluídas**.
- Produção bloqueada até publicar teste fechado, obter **12 testadores participantes por 14 dias contínuos** e solicitar acesso. Havia **0 participantes**; não existe atalho técnico para esse requisito.

Depois das correções, a ficha foi concluída e o painel deixou de exibir a etapa inicial pendente. Foram salvos, sem envio para análise: ficha com cinco screenshots, URLs, acesso restrito com conta verificada, categoria Produtividade, declaração de gerenciamento de saúde e Segurança dos dados refeita (12 tipos/8 categorias). A tabela completa, exceções de compartilhamento, opções e limitações ficam em [console-audit.md](console-audit.md). A marcação “concluída” não certifica conformidade nem atualiza artefatos antigos.

Não foram autorizados envio para análise, lançamento de faixa, convites a testadores, solicitação de produção, deploy do site, alteração de regras do backend ou revogação de credenciais. O preenchimento autorizado é **rascunho**. Upload manual continua sendo o caminho previsto, sem EAS Submit ou criação de service account.

## Textos e recursos da ficha

Fonte dos textos: [`listing.pt-BR.json`](listing.pt-BR.json). Nome existente preservado: “Home Care”.

| Campo | Limite | Preparado |
| --- | --- | --- |
| Nome | 30 caracteres | 9 |
| Descrição curta | 80 caracteres | 71 |
| Descrição completa | 4.000 caracteres | 1.451 |
| Ícone | PNG/JPEG 512×512, até 1 MB | `assets/icon-512.png` |
| Gráfico de destaque | PNG/JPEG 1024×500, até 15 MB | `assets/feature-graphic-1024x500.png` |
| Telas de telefone | 2–8 PNG/JPEG, 9:16 ou 16:9, 320–3.840 px/lado, até 8 MB cada | Capturas `assets/phone-*.png` |

As dimensões e os limites acima foram lidos no formulário deste app. Para qualificação promocional, o Console pede pelo menos quatro telas com no mínimo 1.080 px em cada lado.

O texto descreve organização de casas, cuidadores, escalas, registros de pagamentos, lembretes e exportações. Não anuncia atendimento médico, diagnóstico, medicação, transferências bancárias nem criptografia ponta a ponta. Explicita que não é um dispositivo médico e orienta consultar profissionais para questões de saúde; o mesmo esclarecimento foi incluído na política dentro do app. Vídeo é opcional e não foi inventado.

**Enquadramento de saúde corrigido com autorização do proprietário:** o Google inclui apoio ao cuidado de idosos/logística de cuidados em “Serviços e gerenciamento de saúde”. A ausência de diagnóstico ou Health Connect não basta para declarar ausência de qualquer recurso de saúde. Foi selecionada **somente** essa categoria, removendo “Meu app não tem recursos de saúde”; nenhuma função clínica/dispositivo médico foi declarada. O Console não exigiu documentação regional de dispositivos médicos nessa seleção. A alteração foi salva na fila, não enviada para análise.

A ficha foi salva e reaberta no Console com os textos, ícone, gráfico e **cinco capturas reais 1080×1920**. Após a avaliação dos recursos e o salvamento, passou a **“Pronta para revisão”**; não foi enviada para análise. O gráfico montado com assistência de IA foi rotulado individualmente no formulário de recursos; ícone reutilizado e screenshots reais não foram marcados como sintéticos.

O ícone deriva de `assets/icon.png`. O gráfico reutiliza `assets/brand/homecare-mark-inverse.png`, sem dados de usuários nem telas simuladas. Para reproduzi-lo com librsvg e ImageMagick:

```sh
mkdir -p reports/google-play
rsvg-convert docs/google-play/assets/feature-background.svg -o reports/google-play/feature-background.png
magick assets/brand/homecare-mark-inverse.png -resize 244x244 reports/google-play/feature-mark.png
magick reports/google-play/feature-background.png reports/google-play/feature-mark.png -geometry +690+125 -composite -strip docs/google-play/assets/feature-graphic-1024x500.png
magick assets/icon.png -resize 512x512 -alpha off -strip docs/google-play/assets/icon-512.png
node scripts/check-play-listing.mjs
```

O verificador falha enquanto houver menos de duas capturas. Ele verifica limites textuais e PNGs, não autenticidade visual, conformidade jurídica ou estado remoto da Console.

## Páginas legais e comportamento real

URLs fornecidas pelo proprietário e verificadas como públicas:

- Política: <https://pedrorbc.com/homecare/privacy>
- Solicitação externa de exclusão: <https://pedrorbc.com/homecare/data-deletion>

O app referenciava `/privacy`, que retornava 404. A política interna foi atualizada para os endereços corretos e teve sua versão alterada para **2026-10-18**, exigindo novo aceite. Termos não foram versionados novamente.

A revisão esclarece criptografia por campos e suas exceções, estatísticas não necessariamente anônimas, FCM/token de instalação e limites de retenção/exclusão. Isso **não altera** a implementação de exclusão nem certifica sua completude: existem registros de terceiros e vínculos que podem permanecer com estado recusado. Fluxos de exclusão retomável, resíduos e ciclo de vida de tokens precisam de trabalho específico e testes antes de prometer eliminação integral.

A página pública consultada não explicita token de instalação/FCM; também é necessário conciliar nela as descrições de foto/URL de perfil e contexto técnico/país aproximado processado pelos SDKs (sem GPS). O inventário interno e a Segurança dos dados foram ampliados para refletir esses fluxos. Sua atualização é uma pendência externa do responsável pelo site; nenhuma mudança foi publicada na hospedagem por esta tarefa.

## Capturas e verificação Android

Usar o aplicativo nativo em development build, não Expo Go e não screenshots de navegador. O ambiente local deve usar configuração sintética `scripts/fixtures/firebase-ci.json`, projeto `demo-homecare-ci` e Auth/Firestore emulados. Nunca usar contas reais ou dados de pacientes/famílias para screenshots.

Ambiente preparado nesta sessão: AVD **`homecare-playstore-20261018`**, serial **`emulator-5580`**, Android 15/API 35, x86_64, tela **1080×1920**. Development build novo compilado e instalado a partir deste checkout; o Gradle confirmou compile/target API36 e min API24. Isso não verifica o AAB de produção anterior.

O `avdmanager` usa o diretório XDG local; o emulator precisa de `ANDROID_AVD_HOME=/home/pedro/.config/.android/avd` nesta máquina. Em outros ambientes, descubra o diretório em vez de copiar esse caminho. O Expo seleciona este AVD pelo nome; ADB usa o serial explicitamente.

Instruções reproduzíveis de isolamento e seed ficam em [local-screenshots.md](local-screenshots.md). Foram exercitados login local com email/senha, verificação de email exclusivamente pelo Auth Emulator, aceite obrigatório com telemetria opcional desligada, seleção de português, navegação de casas/calendário/cuidadores/pagamentos/histórico e teclado. As cinco imagens foram inspecionadas antes do upload, sem modificar o conteúdo das telas. Ícones de notificações de desenvolvimento foram escondidos somente pela configuração de captura da barra do Android.

O emulador e os serviços Firebase locais foram encerrados pelo limite de duas horas das tarefas em background após as capturas. Não houve limpeza de armazenamento/desinstalação. A navegação visual específica pelos novos links legais e a tela de erro do bootstrap não foram concluídas antes do encerramento; as páginas públicas foram verificadas por HTTP, mas não afirmar aprovação visual dessas interações.

Verificações executadas: lint/Prettier, TypeScript, **241 testes unitários/36 arquivos**, **98 testes de helpers**, **Expo Doctor18/18**, checagem de segredos rastreados, compatibilidade de dependências, configuração sintética de build e validação textual/PNG da ficha. Revisão focada identificou erro do bootstrap potencialmente oculto pelo splash; o ramo de erro agora também chama `hideAsync`. Testes de regras com emulador não foram reexecutados nesta tarefa; login social real, instalação via Play e ciclo completo de exclusão também não foram certificados.

## Versão e liberação

Para avisar sobre novas versões dentro do app, siga [a configuração de atualizações via Firebase Remote Config](app-updates.md). A versão disponível precisa ser informada após sua liberação na Play Store; o app não consulta a loja diretamente.

A build assinada **2.6.0 / versionCode29** anterior está documentada em [credenciais e release](../credentials-and-release.md). Ela não estava neste checkout, mas foi localizada no diretório de relatórios ignorado do worktree anterior. Inspeção do APK confirmou package correto, versão 2.6.0/código29, target API36, min API24 e ABIs arm64-v8a/x86_64. `zipalign -c -P 16 4` passou; também foram inspecionadas **52 bibliotecas ELF64** dessas ABIs, sem segmento LOAD com alinhamento inferior a16KB ou congruência inválida de offset/endereço. Isso não substitui execução em dispositivo16KB nem valida o futuro AAB reconstruído. `jarsigner` reconheceu a assinatura do AAB e emitiu avisos de certificado autoassinado/sem timestamp e inconsistências de leitura JarFile/JarInputStream; não interpretar isso como uma certificação nova de prontidão do bundle. O SHA-256 do AAB inspecionado é `95f91bda2e48dc60a489a3054a8b3b8168b05b6cfdb9b142585a420531d2906b`.

Na visão de pacotes mais recentes do Console, o maior código exibido foi **27 / 2.5.0**, ativo em teste interno, e havia uma faixa Alpha em rascunho. Ao abrir esse rascunho, ele estava **sem bundle selecionado e sem nome de versão**, portanto a etapa “criar versão” marcada como concluída não representa uma versão pronta para distribuir. A consulta dessa lista não é reserva do próximo código: reconferir todos os códigos antes de novo build/envio. Não foi enviado o AAB29 por esta tarefa.

As [notas pt-BR preparadas](release-notes.pt-BR.txt) são para a futura build que contenha estas alterações; não foram aplicadas a um artefato antigo nem enviadas ao Console.

As correções JavaScript/política desta preparação **não entram retroativamente** no AAB antigo. O APK29 anterior ainda contém `AD_ID` e permissões `ACCESS_ADSERVICES_*` herdadas de SDKs. Elas foram bloqueadas em `app.config.ts` e a ausência foi confirmada no APK de desenvolvimento reconstruído e no **manifest mesclado da variante release**, gerado com configuração sintética (target36, backup desligado, não-debuggable). A primeira tentativa desse check falhou por falta das variáveis de configuração; a repetição com `NODE_ENV=production`, fixture explícito e emuladores desligados passou, sem limpar caches. Isso não gera um AAB assinado, não altera o artefato antigo nem comprova a ausência em todos os bundles ativos na Play. Antes de responder a declaração de Advertising ID ou distribuir, gerar e inspecionar o novo AAB assinado adequado, coordenando explicitamente o código entre EAS/GitHub/Play. Nenhum código remoto foi incrementado por esta tarefa.

Verificar o artefato escolhido com ferramentas existentes de assinatura/inspeção e, quando disponíveis, `bundletool`, manifest final, targetSDK, permissões e bibliotecas nativas/16KB. Checks de fonte ou screenshots em dev não comprovam a assinatura nem o comportamento da instalação Play.

### Próximas ações que dependem do proprietário

1. Aprovar correções substantivas propostas pela auditoria (sem trocar declarações às cegas).
2. Garantir acesso de revisão com conta estável e dados sintéticos, sem depender de login social pessoal; inserir credenciais somente no canal privado da Play.
3. Informar países/regiões e grupo/lista de testadores reais; não incluir pessoas sem consentimento.
4. Escolher e validar AAB, criar versão de teste fechado e aprovar envio para análise separadamente.
5. Após aprovação e adesão de 12 pessoas, cumprir 14 dias contínuos, testar de verdade e registrar feedback.
6. Solicitar acesso à produção com respostas factuais. A aprovação é decisão do Google; elegibilidade não garante publicação.

## Referências

- [Requisitos de teste e acesso à produção](https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt-BR)
- [Exclusão de conta e recurso web](https://support.google.com/googleplay/android-developer/answer/13327111?hl=pt-BR)
- [Declaração de apps de saúde](https://support.google.com/googleplay/android-developer/answer/14738291?hl=pt-BR)
- [Requisitos de target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=pt-BR)
