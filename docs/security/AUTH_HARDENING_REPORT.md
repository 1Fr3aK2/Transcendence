# Auth & Rate Limiting Hardening Report

**Data:** 2026-09-21
**Branch:** `fix/modsecurity+`
**Autor:** Rafael Matos (Cybersecurity / DevOps / Monitoring)

## Resumo

Durante a revisão de segurança do backend e da configuração de rede, foram
identificadas seis vulnerabilidades/gaps de segurança, todas corrigidas e
testadas nesta sessão. Cada uma é documentada abaixo com o problema, a causa
raiz, a correção aplicada e a evidência do teste.

---

## 1. Rate limit de login com bloqueio global

**Ficheiro:** `backend/src/auth/auth.service.ts`

**Problema:** o `RateLimiterService` usado em `AuthService.login()` tinha
uma key fixa:
```ts
const key = "login_attempts:";
```
Sem nenhuma variável, esta key era partilhada por **todos** os pedidos de
login, de todos os utilizadores. Após 5 falhas de login de qualquer origem
(sem precisar de credenciais válidas), o login ficava bloqueado para toda a
plataforma durante 30 minutos — um DoS trivial e não autenticado.

**Correção:**
```ts
const key = `login_attempts:${dto.username}`;
```
O contador passou a ser isolado por conta. O `resetLimit(key)` já existente
no fim do método herdou automaticamente o comportamento correto, por
reutilizar a mesma variável.

**Teste:** confirmado que tentativas falhadas contra uma conta não afetam o
login de outras contas.

---

## 2. `JWT_SECRET` com fallback hardcoded

**Ficheiros:** `backend/src/auth/auth.module.ts`, `backend/src/auth/jwt.strategy.ts`

**Problema:** ambos os ficheiros tinham `process.env.JWT_SECRET || 'secret'`.
Se a variável de ambiente não estivesse definida (o que se confirmou estar
a acontecer em produção neste momento), a aplicação assinava e validava
todos os JWTs com a string literal `'secret'`, pública no código-fonte.
Qualquer pessoa podia forjar um token válido para qualquer `userId`,
incluindo admin, sem autenticação nenhuma.

**Correção:**
- Removido o fallback nos dois ficheiros.
- `jwt.strategy.ts` agora lança erro explícito no arranque se `JWT_SECRET`
  não estiver definida (fail-fast).
- Descoberto e corrigido um bug secundário: `JwtModule.register({...})` em
  `auth.module.ts` era avaliado no momento do `import` (antes de
  `loadSecretsFromVault()` correr no `bootstrap()`), pelo que `JWT_SECRET`
  chegava sempre `undefined` a esse módulo, mesmo depois do Vault responder.
  Corrigido substituindo por `JwtModule.registerAsync({ useFactory: ... })`,
  que adia a leitura para a fase de instanciação.

**Teste:**
- Confirmado nos logs: sem `JWT_SECRET`, o backend falha o arranque com
  `Error: JWT_SECRET environment variable is not set`.
- Prova de conceito: um JWT forjado manualmente com o secret `'secret'` foi
  aceite pela API (`GET /auth/me`) *antes* da correção, e devolveu `401`
  *depois* da correção, usando o mesmo token.

---

## 3. `JWT_SECRET` migrado para o Vault

Seguindo o mesmo padrão já usado para `ADMIN_API_KEY`/`ADMIN_USERNAME`/
`ADMIN_EMAIL`/`ADMIN_PASSWORD`:

- Novo secret `secret/jwt` (campo `secret`) gravado pelo `vault_init.sh`.
- Novo `path "secret/data/jwt"` com `capabilities = ["read"]` na
  `backend-policy.hcl`.
- `JWT_SECRET` passou a estar apenas no `environment:` do serviço
  `vault_init` no `docker-compose.yml` — nunca no `environment:` do
  `backend`.
- `vault-bootstrap.ts` lê `secret/jwt` via `readVaultSecret()` (já genérica)
  e atribui a `process.env.JWT_SECRET` antes do `NestFactory.create()`.

**Teste:** confirmado que `docker compose exec backend env | grep JWT_SECRET`
devolve vazio (a secret nunca existe como variável de ambiente do
container, só em memória do processo Node depois do login AppRole ao
Vault) — mesmo comportamento já validado para `ADMIN_API_KEY`.

---

## 4. Audit log do ModSecurity a expor credenciais em claro

**Ficheiro:** `docker-compose.yml` (serviço `nginx`)

**Problema (reportado por um colega da equipa):** o `SecAuditLogParts` por
omissão da imagem (`ABIJDEFHZ`) inclui a parte `B` (request headers), o que
significa que o header `X-API-Key` — e potencialmente qualquer
`Authorization` — ficava gravado em claro no audit log do ModSecurity.

**Investigação:** a tentativa inicial do colega de usar a action
`sanitiseRequestHeader:X-API-Key` falhou porque essa action é do
ModSecurity v2 (legacy) e não é suportada pelo conector nginx v3
(libModSecurity3), usado pela imagem `owasp/modsecurity-crs:4-nginx-*`.
Confirmado como limitação conhecida e documentada do conector.

**Correção:** como a redação seletiva por header não está disponível,
removida a parte `B` do audit log por completo:
```yaml
MODSEC_AUDIT_LOG_PARTS: "AIJDEFHZ"
```
Isto elimina qualquer exposição de credenciais em headers, ao custo de
perder visibilidade sobre headers não sensíveis (`User-Agent`,
`Content-Type`) nas entradas de audit log.

**Teste:** confirmado no `docker-compose.yml` atual; o WAF continua ativo
(`modsecurity on`), só a parte de headers deixou de ser registada.

---

## 5. Rate limit por utilizador no fórum

**Ficheiros:** `backend/src/forum/forum.module.ts`, `backend/src/forum/forum.service.ts`

**Contexto:** esta correção estava bloqueada desde que se identificou que
`createPost`/`createComment`/`createReport` no `ForumController` não tinham
guard de autenticação nem `userId` fiável. Um PR posterior da equipa
corrigiu isso (todos os endpoints com `@UseGuards(JwtAuthGuard)`,
`userId` sempre de `request.user.id`), o que desbloqueou este trabalho.

**Implementação:**
- `RateLimiterModule` adicionado aos imports de `ForumModule`.
- `RateLimiterService` injetado em `ForumService`.
- Limites aplicados por `userId`, isolados entre si:
  - `createPost`: 5 pedidos / 10 min (`forum_post:${userId}`)
  - `createComment`: 20 pedidos / 10 min (`forum_comment:${userId}`)
  - `createReport`: 10 pedidos / 1 hora (`forum_report:${userId}`)
- Excedido o limite, lança `HttpException(..., HttpStatus.TOO_MANY_REQUESTS)`.

**Teste:** `createPost` confirmado em produção — 5 primeiros pedidos `201`,
6º e 7º pedidos `429` com a mensagem correta; contador confirmado no Redis
(`forum_post:<userId>`). `createComment`/`createReport` usam exatamente o
mesmo mecanismo (`checkLimit`), já validado.

---

## 6. Swagger da Public Admin API exposto sem autenticação

**Ficheiro:** `backend/src/main.ts`

**Problema:** `SwaggerModule.setup('api/admin/docs', app, document)` não
tinha nenhum guard — qualquer pessoa conseguia ver a documentação completa
da Public Admin API (endpoints, DTOs, parâmetros) sem a `ADMIN_API_KEY`.

**Correção:** como `SwaggerModule.setup` não cria rotas de controller (não
há onde pôr `@UseGuards`), foi adicionado um middleware Express
(`app.use(...)`) **antes** do `SwaggerModule.setup`, reaproveitando a mesma
verificação hash SHA-256 + `timingSafeEqual` já usada no `AdminApiKeyGuard`.
Aplicado a dois paths: `/api/admin/docs` (UI) e `/api/admin/docs-json`
(spec JSON cru, gerado automaticamente pelo Swagger e facilmente esquecido).

**Teste:** confirmado — sem `X-API-Key`, ambos os paths devolvem `401`; com
a chave correta, `200`.

---

## 7. Rate limit global partilhado da Public Admin API

**Ficheiro:** `backend/src/public-api/admin-api-rate-limit.guard.ts`

**Problema:** a key do rate limiter era a string fixa `'admin_api_requests'`,
partilhada por todos os consumidores da API. Um único cliente com uso
intenso podia esgotar a quota (100 req/60s) para todos os outros.

**Correção:** key alterada para incluir o IP do cliente (lido de
`X-Real-IP`, preenchido pelo nginx, com fallback para `request.ip`):
```ts
const clientIp = (request.headers['x-real-ip'] as string) || request.ip;
await this.rateLimiterService.checkLimit(`admin_api_requests:${clientIp}`, 100, 60);
```
Limitação conhecida: consumidores atrás do mesmo IP/NAT continuam a
partilhar quota entre si — melhoria futura seria chaves de API por cliente.

**Teste:** testado diretamente contra o backend (saltando o rate limit do
nginx, que intercetava primeiro por ser mais restritivo a nível de rede) —
confirmados exatamente 100 sucessos seguidos e `429` a partir do 101º
pedido.

---

## Achado à parte: resolução DNS do nginx em cache

Durante os testes, um `502 Bad Gateway` (mascarado como `403` pelo próprio
WAF, que interceta respostas 5xx — regra 950100/959100) revelou que o
nginx, a correr há 47h sem reiniciar, tinha o IP antigo do container
`backend` em cache de resolução DNS. Como o nginx resolve hostnames uma vez
no arranque dos workers (não reconsulta o DNS interno do Docker em cada
pedido), recriar só o `backend` (via `make update SERVICE=backend`) deixa o
nginx a apontar para um IP morto até ser reiniciado.

**Mitigação aplicada agora:** `docker compose restart nginx`.

**Correção estrutural conhecida, não aplicada por decisão do autor:**
adicionar `resolver 127.0.0.11 valid=10s;` e usar `proxy_pass` via
variável (`set $backend_upstream http://backend:8000; proxy_pass
$backend_upstream;`) para forçar reavaliação periódica do DNS.

---

## Resumo de ficheiros alterados

| Ficheiro | Alteração |
|---|---|
| `backend/src/auth/auth.service.ts` | Rate limit de login por conta |
| `backend/src/auth/auth.module.ts` | Remoção do fallback JWT + `registerAsync` |
| `backend/src/auth/jwt.strategy.ts` | Remoção do fallback JWT + fail-fast |
| `backend/src/vault/vault-bootstrap.ts` | Leitura de `secret/jwt` |
| `vault/config/vault-init.sh` | `vault kv put secret/jwt` |
| `vault/config/backend-policy.hcl` | `path "secret/data/jwt"` |
| `docker-compose.yml` | `JWT_SECRET` no `vault_init`; `MODSEC_AUDIT_LOG_PARTS` no `nginx` |
| `.env` | `JWT_SECRET` gerado |
| `backend/src/forum/forum.module.ts` | Import de `RateLimiterModule` |
| `backend/src/forum/forum.service.ts` | Rate limit por utilizador (post/comment/report) |
| `backend/src/main.ts` | Guard no Swagger da Public Admin API |
| `backend/src/public-api/admin-api-rate-limit.guard.ts` | Rate limit por IP |