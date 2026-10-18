# Capturas Android locais com Firebase Emulators

Fluxo local e opt-in para capturas reais no Android. O modo de emuladores só conecta quando `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`, `__DEV__` está ativo e o Firebase usa um projeto `demo-*`. Release ou projeto/host fora dessas condições bloqueia o bootstrap antes de criar instâncias Auth/Firestore. O JavaScript não inicializa Remote Config/FCM e força Analytics/Crashlytics desligados; autenticação, regras de consentimento e políticas continuam ativas. O build deve usar o fixture sintético: o guard de JavaScript não é uma captura de tráfego nem uma garantia geral sobre auto-inicialização de SDKs nativos antes do bootstrap.

## Iniciar

1. Inicie Auth e Firestore emuladores no checkout, com Firebase CLI 15.30.2 e Java 21+:

   ```sh
   GCLOUD_PROJECT=demo-homecare-ci bunx firebase-tools@15.30.2 emulators:start --project demo-homecare-ci --only auth,firestore
   ```

   O `firebase.json` deste checkout configura Auth `127.0.0.1:9199` e Firestore `127.0.0.1:8180`. A CLI resolve `java` pelo `PATH`; só definir `JAVA_HOME` pode não trocar o executável. Nesta máquina foi necessário usar o Java25 já instalado no `PATH` para os emuladores, preservando o Java17 usado pelo Gradle (sem mudar o default do sistema).

2. Para Android conectado/emulador, faça o reverse das portas para o mesmo dispositivo usado pelo app:

   ```sh
   adb -s emulator-5580 reverse tcp:9199 tcp:9199
   adb -s emulator-5580 reverse tcp:8180 tcp:8180
   ```

   Substitua `emulator-5580` pelo serial escolhido (`adb devices -l`). A aplicação usa endereços loopback, nunca IP de rede.

3. Em outro terminal, crie dados sintéticos no mesmo projeto:

   ```sh
   GCLOUD_PROJECT=demo-homecare-ci \
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 \
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 \
   node scripts/seed-mobile-emulator.mjs
   ```

   O script exige explicitamente projeto demo e hosts/portas locais, cria uma conta de senha aleatória e dados sintéticos de perfil, casa, chave, cuidadora criptografada, escalas e um pagamento. As credenciais ficam em `reports/mobile-emulator-credentials.json` com permissão `0600`; leia esse arquivo localmente para entrar. Não copie a senha para logs, screenshots, mensagens ou arquivos versionados. O script não sobrescreve credenciais existentes.

4. Inicie ou recarregue o Metro do checkout com o opt-in e a configuração Firebase sintética. Para este AVD, o build de desenvolvimento já deve estar instalado:

   ```sh
   EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1 \
   GOOGLE_SERVICES_JSON=./scripts/fixtures/firebase-ci.json \
   EXPO_NO_DOTENV=1 \
   bunx expo start --dev-client
   ```

   O `EXPO_NO_DOTENV=1` evita carregar variáveis locais não intencionais; mantenha `GOOGLE_SERVICES_JSON` apontando para o fixture demo.

5. Entre com os dados salvos em `reports/mobile-emulator-credentials.json`. A conta não vem com aceite de políticas ou consentimento de telemetria; conclua as telas normalmente. O seed usa somente dados fictícios.

## Limpeza e limites

Pare os emuladores com Ctrl+C. Para remover a conta/dados de teste, limpe apenas o estado dos emuladores pelo Firebase Emulator UI/CLI; não use credenciais nem comandos contra projeto real. O seed não apaga nem reseta dados existentes. Não habilite o opt-in em builds release. O modo local desativa Remote Config, Analytics, Crashlytics e FCM; notificações locais do app não representam push real.
