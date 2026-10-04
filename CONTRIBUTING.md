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
