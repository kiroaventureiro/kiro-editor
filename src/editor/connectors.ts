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

/**
 * User-approved connection permissions are separate from provider capabilities.
 * This catalog is descriptive until server-side identity, persistence, and
 * enforcement are implemented; it must not be used as an authorization check.
 */
export type ConnectionPermission =
  | "project.read"
  | "timeline.edit"
  | "media.add"
  | "media.generate"
  | "project.export"
  | "media.delete";

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

/** Server-side grant shape to persist only after KIRO auth is available. */
export interface ConnectorGrant {
  connectorId: string;
  permissions: ConnectionPermission[];
  createdAt: string;
  expiresAt?: string;
}

export const editorPermissionCatalog: {
  id: ConnectionPermission;
  label: string;
  description: string;
}[] = [
  {
    id: "project.read",
    label: "Ler o projeto",
    description: "Permite consultar o projeto e o estado da timeline.",
  },
  {
    id: "timeline.edit",
    label: "Editar a timeline",
    description: "Permite aplicar ações validadas na timeline do projeto.",
  },
  {
    id: "media.add",
    label: "Adicionar mídia",
    description: "Permite adicionar arquivos aprovados à Library ou à timeline.",
  },
  {
    id: "media.generate",
    label: "Gerar mídia",
    description: "Permite solicitar geração de mídia sujeita à autenticação e quota.",
  },
  {
    id: "project.export",
    label: "Exportar",
    description: "Permite iniciar a exportação do projeto atual.",
  },
  {
    id: "media.delete",
    label: "Excluir mídia",
    description: "Permite remover mídia; ações destrutivas exigem validação explícita.",
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

/** Pure helper for the future server authorization layer; not auth by itself. */
export function grantAllows(
  grant: ConnectorGrant,
  permission: ConnectionPermission,
) {
  return grant.permissions.includes(permission);
}
