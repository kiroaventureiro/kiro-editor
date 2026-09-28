# Auditoria de arquitetura — KIRO Editor (2026-09-26)

Branch auditada: `feat/kiro-ai-editor-actions`
HEAD auditado: `fda291ee57e437480965b3a9b354d4c46edc33c3`
PR observado: #2, contra `feat/editor-studio-foundation`.

## Estado ativo comprovado

- SPA Vite/React/TypeScript; APIs em `api/*.js` são endpoints de função no deploy Vercel.
- Creator Hub está integrado com Chat, Gerar, Agentes, Conexões e Biblioteca.
- Planejamento KIRO IA passa por `api/kiro-ai.js` e catálogo de ações validado no editor; operações manuais e histórico/Undo continuam fora da dependência de quota de IA.
- Geração xAI está em `api/generate-media.js`; exige variáveis de servidor e `CREATOR_HUB_GENERATION_ENABLED=true`.
- `api/creator-connectors.js` reporta configuração por existência de variáveis de ambiente; isso não é identidade ou conexão de usuário.
- `api/generate-media.js` usa atualmente `CREATOR_HUB_ADMIN_TOKEN` como bearer estático. Não é sessão central KIRO, conexão OAuth de usuário, autorização por escopos, nem quota. A geração deve permanecer desabilitada até a nova autenticação e controles serem implementados.
- `src/editor/connectors.ts` é catálogo de capacidades/provedores; não há armazenamento server-side de conexões por usuário nem enforcement por conexão.
- Não há dependência ou migration de banco/auth central no `package.json`; a migration Supabase existente se refere à Library do Editor e não prova que o Supabase seja backend compartilhado com Guardiões ou KIRO Gestão.

## Classificação das dependências

### ATIVO

- React/Vite/TypeScript, build e testes do editor.
- API routes Vercel atuais, executor seguro de ações, histórico/undo-redo, armazenamento local do projeto e fluxo atual de mídia.
- Credenciais de provedores somente em ambiente de servidor nos caminhos existentes; sem secrets no bundle do navegador.

### HISTÓRICO

- Planos de OAuth/MCP, storage seguro, quotas, KIRO central auth e ingestão para Library descritos como próximos passos nos documentos existentes; documentação não equivale a implementação.

### DESCARTADO

- Nenhuma conexão/provider foi descartada nesta auditoria; não migrar código ou schema de outros produtos por conveniência.

### DÚVIDA

- Identidade e sessão central KIRO a integrar: endpoint/issuer, claims, audience, revogação e ambiente ainda não estão definidos no repositório.
- Persistência de conexão, consentimento, quotas e auditoria: backend de dados e limites do plano ainda não existem aqui.
- OAuth suportado por cada provedor: validar fluxos reais/termos antes de anunciar OAuth como disponível. MCP é um protocolo/conector, não um mecanismo automático de login.
- KIRO Library e seu destino/storage: verificar separação entre usuário, conteúdo público e acervo interno antes de persistência de mídia.
- Custos, unidades de consumo e limites de bloqueio ainda requerem definição de produto.

## CI, Vercel e risco atual

- Workflow `.github/workflows/editor-checks.yml` executa TypeScript, testes unitários, build e E2E Playwright.
- No run #197 para o HEAD, TypeScript, 7 testes unitários e build passaram; E2E falhou em `tests/browser.mjs:112`: Playwright não encontrou `getByLabel('Posição em segundos')` após iniciar a montagem. Isso aponta seletor/teste ou fluxo de preview desatualizado e precisa ser corrigido antes de declarar CI verde; não alterar sincronização de playback sem reproduzir e isolar a causa.
- O check Vercel associado ao HEAD foi reportado como success. A inspeção do deployment Vercel não resolveu o identificador fornecido; estado/URL pública específica do Preview permanece DÚVIDA.
- Nenhuma alteração de produção foi feita nesta auditoria.

## Primeiro lote seguro e prioridade

1. Preservar geração externa fechada; não converter o bearer administrativo atual em falsa autenticação de usuário.
2. Fechar contrato com a autenticação central KIRO e selecionar persistência isolada do Editor antes de criar sessões/tabelas.
3. Implementar primeiro quotas no backend com limite por usuário/plano/provedor e bloqueio de gastos, deixando ações manuais/editor livres.
4. Implementar conexão server-side com OAuth apenas nos provedores que suportarem o fluxo; BYOK fallback cifrado apenas no servidor; MCP com credencial/consentimento próprio.
5. Aplicar permissões por conexão (ler projeto, editar timeline, adicionar mídia, gerar, exportar e excluir mídia) no servidor e validar novamente ações localmente para preservar undo.
6. Corrigir/reproduzir o E2E antes de expandir integrações.
7. Validar Preview, builds e escopo dos dados antes de qualquer produção.

Não inserir secret, token de usuário ou chave de provedor em código ou localStorage. Não compartilhar dados ou schema entre Guardiões, Gestão, Sistema Origem e Editor sem contrato explícito.


## Follow-up de implementação — 2026-09-27

- Commit `9bdbf0c69d0444eb970d110977468fc97488bd2d`: o teste E2E passou a posicionar o playhead pela régua real da timeline (`.ruler`) e validar avanço por `.ruler-playhead`; nenhuma lógica de playback/sincronização foi alterada.
- O primeiro E2E atualizado expôs que o WebM exportado não continha duração nos metadados, embora vídeo e áudio fossem decodificáveis. A dependência já presente `fix-webm-duration` não era chamada pelo renderizador.
- Commit `0a16438520d5d61c842f0c96832b50aea22b2fa4`: o renderizador corrige os metadados da exportação WebM com o tempo gravado medido, sem mudar a timeline nem o formato da captura.
- CI run #201 passou: TypeScript, 7 testes unitários, build e E2E Playwright. O E2E validou seeks nos três vídeos, reprodução contínua, persistência, exportação 1280×720 com vídeo/áudio, duração e conteúdo de cada trecho.
- Check Vercel do commit #201: success. Sem alteração de produção.

## Bloqueio remanescente para auth e quotas

A única sessão de usuário encontrada é a autenticação Supabase usada pelo painel administrativo da Library. Ela não é identidade central KIRO nem deve ser reutilizada como tal. Antes de implementar conexões server-side, OAuth/BYOK seguro ou quotas, falta definir e disponibilizar: issuer/URL da autenticação KIRO, audience/claims e estratégia de revogação; persistência isolada do Editor; e limites/unidades de consumo por plano/provedor. Até lá, geração paga segue fechada e o bearer administrativo não é tratado como login de usuário.
