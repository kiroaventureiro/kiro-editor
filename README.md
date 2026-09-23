# KIRO Editor 0.4 — Web + Mobile

Editor de vídeo pessoal da KIRO Produções. Uma única base para navegador, mobile e futuro app Windows.

## Estado atual
- Importa vídeo, imagem e áudio localmente.
- Faz preview de mídia.
- Adiciona itens à timeline.
- Move clipes pela timeline com mouse ou toque.
- Faz trim pelas bordas do clipe.
- Divide clipes no playhead.
- Sincroniza playhead e preview.
- Ajusta volume e velocidade.
- Desfazer / Refazer com histórico de até 50 estados.
- Atalhos: Ctrl/Cmd+Z, Ctrl/Cmd+Y, Shift+Ctrl/Cmd+Z e Ctrl/Cmd+S.
- Presets 16:9, 9:16, 1:1 e 4:5.
- Interface responsiva para PC, celular e tablet.
- Manifest PWA e configuração Vercel preparados.
- Tauri permanece no projeto para a futura build nativa de Windows.

## Salvamento atual
O projeto é salvo localmente no navegador. A estrutura da edição fica preservada, mas as mídias locais ainda precisam ser reconectadas depois de recarregar a página. Persistência de arquivos em IndexedDB e sincronização em nuvem entram nos próximos marcos.

## Desenvolvimento
```bash
npm install
npm run dev
```

## Validação
```bash
npm run check
npm run build
```

## Deploy web
O arquivo `vercel.json` já está preparado. O próximo passo é importar `kiroaventureiro/kiro-editor` no Vercel para validar o build e liberar o acesso pelo celular.

## Próximos marcos
1. Persistência local de mídia com IndexedDB.
2. Exportação inicial 720p / 1080p.
3. Login e projetos na nuvem.
4. Modo História KIRO.
5. KIRO IA para comandos de edição.

Veja `docs/WEB-MOBILE.md` para a arquitetura e os próximos passos.
