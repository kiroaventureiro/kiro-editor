# Creator Hub — Conexões de IA e plataformas

Status: arquitetura ativa na branch `feat/kiro-ai-editor-actions`.

## Objetivo

Transformar o KIRO Editor em uma central de criação que permita ao usuário conectar provedores e agentes sem copiar segredos para o código do editor.

O fluxo preferido é semelhante a integrações modernas como GitHub ↔ Vercel:

```text
Usuário
  ↓
Creator Hub > Conexões
  ↓
Conectar provedor
  ↓
OAuth / MCP OAuth, quando o provedor oferecer
  ↓
consentimento explícito de escopos
  ↓
conexão registrada no backend KIRO
  ↓
provedor usa somente as capacidades concedidas
```

BYOK continua existindo apenas como fallback para provedores que não oferecem OAuth adequado para aplicativos de terceiros.

## Regra central

Nenhum provedor recebe acesso direto e irrestrito ao JSON do projeto.

Toda edição passa pelo catálogo de ações do KIRO Editor e pelo executor local seguro. Isso permite compartilhar o mesmo mecanismo entre OpenAI, Grok/xAI, Codex, MCPs e futuros provedores.

## Segunda página: Creator Hub

A página será independente da timeline principal, mas conectada ao mesmo projeto e à KIRO Library.

Áreas previstas:

- Chat
- Gerar
- Agentes
- Conexões
- Biblioteca

## Conexões

Cada provedor declara capacidades reais, por exemplo:

- chat
- editor.read
- editor.write
- image.generate
- image.edit
- video.generate
- video.edit
- audio.generate
- speech.transcribe
- agent
- mcp

O arquivo `src/editor/connectors.ts` é o registro neutro dessas capacidades.

## Consentimento

Ao conectar um provedor ao KIRO Editor, o usuário deve aprovar permissões específicas. Exemplo:

- Ler projeto atual
- Editar timeline
- Gerar imagens
- Gerar vídeos
- Adicionar mídia ao projeto

Ações destrutivas e exportação devem ganhar escopos próprios antes de serem expostas a conectores externos.

## Dois sentidos de integração

### Provedor dentro do KIRO Editor

O Creator Hub atua como cliente e usa o provedor para conversar, gerar ou editar mídia.

### KIRO Editor dentro de um agente externo

O KIRO Editor expõe ferramentas via MCP protegido por OAuth. Assim ChatGPT, agentes compatíveis e outros clientes podem pedir ações no projeto.

Os dois sentidos compartilham o mesmo catálogo de ferramentas e permissões.

## Segurança

- nunca salvar senha do provedor;
- nunca colocar segredo no bundle do navegador;
- OAuth tokens ficam somente no backend seguro;
- BYOK deve ser criptografado no servidor ou mantido apenas durante sessão segura;
- cada conexão tem escopos próprios;
- ações passam pelo validador do editor;
- trilhas bloqueadas continuam bloqueadas para IA;
- operações executadas pela IA entram no histórico/Undo;
- conexões podem ser revogadas pelo usuário;
- limites e orçamento são aplicados por conta/plano/provedor.

## KIRO Produções e usuários comuns

A arquitetura é a mesma para os dois, mas as permissões e recursos podem variar.

KIRO Produções/Admin pode conectar provedores internos, automações e acervos privados.

Usuários do editor veem apenas provedores liberados para o plano e conectam suas próprias contas quando o fluxo permitir.

## Próximas implementações

1. página visual Creator Hub;
2. armazenamento seguro de conexões;
3. fluxo de consentimento KIRO;
4. primeira conexão OpenAI/KIRO IA;
5. conexão xAI/Grok para geração de imagem/vídeo;
6. importação automática do resultado para KIRO Library;
7. MCP server do KIRO Editor;
8. quotas e rate limits por usuário/plano.
