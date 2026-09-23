# KIRO Editor 0.3 — Web + Mobile

Editor de vídeo pessoal da KIRO Produções. Uma única base para navegador, mobile e futuro app Windows.

## Estado atual
- Importa vídeo, imagem e áudio localmente.
- Faz preview de mídia.
- Adiciona itens à timeline.
- Ajusta volume e velocidade.
- Presets 16:9, 9:16, 1:1 e 4:5.
- Interface responsiva para PC, celular e tablet.
- Manifest PWA e configuração Vercel preparados.
- Tauri permanece no projeto para a futura build nativa de Windows.

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
O arquivo `vercel.json` já está pronto. Depois que o repositório GitHub existir, importe-o no Vercel.

Veja `docs/WEB-MOBILE.md` para a arquitetura e os próximos passos.
