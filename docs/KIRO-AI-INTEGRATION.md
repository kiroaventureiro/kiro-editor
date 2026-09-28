# KIRO IA + ChatGPT no KIRO Editor

Status: implementação em branch de trabalho `feat/kiro-ai-editor-actions`.

## Objetivo

Permitir conversar com uma IA dentro do KIRO Editor e transformar instruções naturais em operações reais e reversíveis na timeline e no canvas, sem dar ao modelo acesso irrestrito ao projeto.

Exemplos esperados:

- "corte o clipe selecionado neste ponto";
- "abaixe este áudio para 70%";
- "deixe esta legenda maior e com fundo amarelo";
- "mova este texto para 12 segundos";
- "remova estes clipes com ripple".

## Arquitetura escolhida

```text
Usuário
  ↓
Painel KIRO IA dentro do editor
  ↓
/api/kiro-ai
  ↓
OpenAI Responses API
  ↓
function call: apply_editor_actions
  ↓
validador local do KIRO Editor
  ↓
applyKiroAiCommands()
  ↓
projeto / timeline / canvas
  ↓
histórico do editor / Undo
```

A IA não recebe acesso direto ao estado interno nem pode alterar JSON arbitrariamente. Ela solicita ações de uma lista permitida e o editor valida cada comando antes de aplicá-lo.

## Primeiras ações permitidas

- `split_clip`
- `delete_clips`
- `move_clip`
- `update_clip`
- `set_track`
- `add_text`

O executor limita cada lote a 40 ações e respeita trilhas bloqueadas e limites de propriedades.

## Dois tipos diferentes de integração

### 1. Chat dentro do KIRO Editor

É o caminho principal para a interface do produto. Pode usar Responses API diretamente ou ChatKit com backend próprio.

Isso permite uma experiência visual integrada ao editor, com contexto do projeto aberto e execução de ferramentas do próprio KIRO Editor.

### 2. KIRO Editor conectado ao ChatGPT

É o caminho inverso: expor ações do KIRO Editor como ferramentas MCP / app do ChatGPT.

Nesse modo, o usuário pode conversar no ChatGPT e autorizar ações no KIRO Editor. O Apps SDK do ChatGPT é baseado em MCP e permite apps com ações de escrita quando configuradas e autorizadas.

Esses dois caminhos podem coexistir e compartilhar o mesmo catálogo de operações do editor.

## Segurança e custo

- chave OpenAI nunca vai para o navegador;
- endpoint aceita contexto compacto, não arquivos inteiros;
- prompt limitado a 4.000 caracteres;
- contexto HTTP limitado a aproximadamente 220 KB;
- no máximo 40 ações por execução;
- modelo padrão de planejamento: `gpt-5.6-luna`, configurável por `KIRO_AI_MODEL`;
- se `AI_GATEWAY_API_KEY` existir, o endpoint usa Vercel AI Gateway;
- caso contrário, usa `OPENAI_API_KEY` diretamente;
- orçamento no AI Gateway deve ser configurado no projeto antes da liberação pública;
- operações manuais do editor continuam funcionando mesmo se a IA atingir limite ou ficar indisponível.

## Variáveis previstas

```bash
AI_GATEWAY_API_KEY=
OPENAI_API_KEY=
KIRO_AI_MODEL=gpt-5.6-luna
```

Somente uma das chaves de IA é necessária. Para produção pública, preferir AI Gateway para centralizar observabilidade e orçamento.

## Estado atual

Implementado nesta branch:

- executor seguro de comandos (`src/editor/aiCommands.ts`);
- endpoint de planejamento (`api/kiro-ai.js`);
- painel de chat (`src/components/KiroAiPanel.tsx`);
- contexto compacto do projeto;
- suporte a respostas sem edição e respostas que geram ações;
- fallback entre AI Gateway e OpenAI direta.

Próxima etapa:

1. montar o painel no `App.tsx`;
2. aplicar o resultado como uma única operação no histórico para Undo;
3. adicionar confirmação visual das ações realizadas;
4. criar cotas por usuário/plano;
5. expor o mesmo catálogo de operações via MCP para uma futura integração direta com ChatGPT.
