# Contribuindo

## Verificações locais

As mesmas verificações rodam no CI (`.github/workflows/ci.yml`) em cada pull request:

| Comando                                                      | O que faz                                               |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| `bun run lint`                                               | ESLint (sem warnings permitidos) + checagem do Prettier |
| `bun run format`                                             | Corrige automaticamente o que for possível              |
| `bun run typecheck`                                          | Checagem de tipos com `tsc --noEmit`                    |
| `bun run test`                                               | Testes unitários (`bun test`)                           |
| `bunx expo prebuild --platform android --no-install --clean` | Gera o projeto nativo Android                           |
| `bunx expo export --platform android`                        | Gera o bundle JavaScript                                |

O prebuild de iOS precisa do `GoogleService-Info.plist`, que não fica no repositório.

## Dev Container e builds Android

O projeto inclui um `.devcontainer` com Node 22, Bun 1.2.15, Java 17 e o Android SDK necessários para desenvolvimento e builds nativos Android. No VS Code, abra a paleta de comandos e execute **Dev Containers: Reopen in Container**. As dependências serão instaladas automaticamente com `bun install --frozen-lockfile`.

Antes de compilar, crie o arquivo local de ambiente sem versioná-lo:

```bash
cp .env.example .env
# Preencha GOOGLE_WEB_CLIENT_ID; GOOGLE_ANDROID_CLIENT_ID é opcional
```

O helper oferece os dois caminhos de build:

```bash
# Build local para validar o release (AAB por padrão; APK também é possível)
.devcontainer/build-android.sh local
.devcontainer/build-android.sh local apk

# Build de produção assinado pelo EAS (gera o AAB de produção)
.devcontainer/build-android.sh eas
```

O build local gera o projeto nativo ignorado em `android/` e coloca os artefatos em `android/app/build/outputs/`. Ele não substitui a assinatura de produção: para publicar, use o caminho EAS, faça `eas login` e configure as credenciais/variáveis no EAS. O arquivo `google-services.json` Android já é usado pela configuração padrão, mas os IDs do Google continuam sendo fornecidos pelo ambiente.

O comando `bunx expo export --platform android --output-dir dist` usado no CI gera somente o bundle JavaScript e os assets; ele não gera APK nem AAB.

O container Linux não consegue gerar binários iOS, pois iOS exige macOS/Xcode e credenciais Apple. Use um Mac ou um build EAS para iOS e forneça o `GoogleService-Info.plist` separadamente.
