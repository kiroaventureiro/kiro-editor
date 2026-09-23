# KIRO Editor 0.3 — Web + Mobile

## Objetivo
A mesma base React deve funcionar no navegador do PC, iPhone/iPad e Android. O desktop nativo via Tauri permanece como camada adicional, não como código separado.

## Arquitetura alvo

```text
GitHub
  └─ KIRO Editor (React + TypeScript + Vite)
      ├─ Vercel → Web / celular / tablet
      ├─ PWA → atalho instalável no celular
      └─ Tauri → aplicativo Windows
```

## O que esta preparação já inclui
- Layout responsivo para telas abaixo de 1100 px.
- Timeline com rolagem horizontal em mobile.
- Biblioteca de mídia horizontal no celular.
- Preview adaptável ao formato do projeto.
- Meta tags mobile e manifest PWA.
- `vercel.json` pronto para deploy Vite.
- `.gitignore` e `.env.example` prontos para GitHub.

## Limitação intencional
Nesta fase os arquivos de mídia ficam no dispositivo e usam Blob URLs. Eles não são enviados automaticamente à nuvem. Isso evita custos e uploads desnecessários durante o MVP.

## Próximo estágio de sincronização
- Supabase Auth para login;
- tabela `projects` para metadados/timeline;
- Storage opcional para proxies/thumbs;
- mídia original permanece local por padrão;
- render pesado futuramente pode ir para worker/backend quando o usuário estiver no mobile.

## Publicação no Vercel
1. Repositório `kiro-editor` na branch `main`.
2. Importar o repositório no Vercel.
3. Framework: Vite.
4. Build: `npm run build`.
5. Output: `dist`.

## Critérios 0.3
- [x] Desktop browser
- [x] Layout mobile responsivo
- [x] Importação local via file picker
- [x] Timeline utilizável em touch por rolagem
- [x] Manifest PWA
- [x] Vercel config
- [ ] Drag/touch de clipes
- [ ] Split no playhead
- [ ] Trim por alças
- [ ] Undo/redo
- [ ] Persistência cross-device
