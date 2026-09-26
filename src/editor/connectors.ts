export type ConnectorAuthMode =
  | "oauth"
  | "mcp-oauth"
  | "byok"
  | "managed";

export type ConnectorCapability =
  | "chat"
  | "editor.read"
  | "editor.write"
  | "image.generate"
  | "image.edit"
  | "video.generate"
  | "video.edit"
  | "audio.generate"
  | "speech.transcribe"
  | "agent"
  | "mcp";

export interface ConnectorDefinition {
  id: string;
  name: string;
  description: string;
  authModes: ConnectorAuthMode[];
  capabilities: ConnectorCapability[];
  category: "assistant" | "generation" | "agent" | "bridge";
  status: "ready" | "planned" | "provider-dependent";
  userConnectable: boolean;
}

export const connectorRegistry: ConnectorDefinition[] = [
  {
    id: "kiro-ai",
    name: "KIRO IA",
    description: "Assistente nativo que usa as ferramentas seguras do KIRO Editor.",
    authModes: ["managed"],
    capabilities: ["chat", "editor.read", "editor.write", "agent"],
    category: "assistant",
    status: "ready",
    userConnectable: false,
  },
  {
    id: "openai",
    name: "OpenAI / ChatGPT",
    description:
      "Conversa, raciocínio e agentes. A conexão pode usar OAuth quando o fluxo compatível estiver disponível ou credencial do próprio usuário como fallback.",
    authModes: ["oauth", "byok"],
    capabilities: [
      "chat",
      "editor.read",
      "editor.write",
      "image.generate",
      "agent",
      "mcp",
    ],
    category: "assistant",
    status: "provider-dependent",
    userConnectable: true,
  },
  {
    id: "xai",
    name: "Grok / xAI",
    description:
      "Conversa e geração de mídia. OAuth será usado quando a xAI disponibilizar um fluxo adequado para apps de terceiros; BYOK permanece como fallback.",
    authModes: ["oauth", "byok"],
    capabilities: [
      "chat",
      "image.generate",
      "image.edit",
      "video.generate",
      "video.edit",
    ],
    category: "generation",
    status: "provider-dependent",
    userConnectable: true,
  },
  {
    id: "codex",
    name: "Codex",
    description:
      "Agente técnico para fluxos avançados e automações do Creator Hub.",
    authModes: ["oauth", "managed"],
    capabilities: ["agent", "editor.read", "editor.write", "mcp"],
    category: "agent",
    status: "planned",
    userConnectable: true,
  },
  {
    id: "custom-mcp",
    name: "MCP personalizado",
    description:
      "Conecta servidores MCP compatíveis sem acoplar o editor a um único fornecedor.",
    authModes: ["mcp-oauth"],
    capabilities: ["mcp", "agent"],
    category: "bridge",
    status: "planned",
    userConnectable: true,
  },
];

export interface ConnectorGrant {
  connectorId: string;
  scopes: ConnectorCapability[];
  createdAt: string;
  expiresAt?: string;
}

export const editorPermissionCatalog: {
  id: ConnectorCapability;
  label: string;
  description: string;
}[] = [
  {
    id: "editor.read",
    label: "Ler o projeto",
    description: "Permite consultar timeline, trilhas, clipes e seleção atual.",
  },
  {
    id: "editor.write",
    label: "Editar o projeto",
    description: "Permite solicitar ações validadas pelo motor do KIRO Editor.",
  },
  {
    id: "image.generate",
    label: "Gerar imagens",
    description: "Permite gerar imagens e adicioná-las à Library ou timeline.",
  },
  {
    id: "video.generate",
    label: "Gerar vídeos",
    description: "Permite gerar vídeos e adicioná-los à Library ou timeline.",
  },
  {
    id: "video.edit",
    label: "Editar mídia por IA",
    description: "Permite enviar mídia para recursos de edição suportados pelo provedor.",
  },
];

export function connectorById(id: string) {
  return connectorRegistry.find((connector) => connector.id === id);
}

export function connectorSupports(
  connector: ConnectorDefinition,
  capability: ConnectorCapability,
) {
  return connector.capabilities.includes(capability);
}
