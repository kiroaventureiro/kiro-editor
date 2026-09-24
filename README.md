# KIRO Editor 0.5 — Studio

Editor de vídeo local no navegador, com React, TypeScript e Vite. A interface é independente da identidade visual do Universo Kiro.

## Recursos

- Projetos e arquivos de mídia preservados em IndexedDB, com salvamento automático e biblioteca de projetos.
- Migração do projeto legado e reconexão de arquivos ausentes. Cópias `.kiroproj.json` contêm a edição, não os arquivos originais.
- Reprodução da sequência completa, com imagens, vídeos, textos e várias trilhas de áudio sincronizadas.
- Exportação local em 720p/1080p usando a mesma composição da prévia: MP4 quando o navegador suporta a combinação de codecs, ou WebM.
- Timeline com miniaturas, ondas de áudio de arquivos de até 24 MB, zoom, encaixe opcional, seleção múltipla, divisão, duplicação e exclusão com fechamento de espaço por trilha.
- Trilha de destino na biblioteca; criação de trilhas de vídeo e áudio; bloqueio e silenciamento.
- Agulha livre durante reprodução, posição digitável e avanço quadro a quadro.
- Cortes limitados à mídia original; mudança de velocidade recalcula a duração sem alterar o trecho de origem.
- Enquadramento por controles ou arrastando na prévia; rotação, escala e opacidade.
- Movimento interpolado entre início e fim; entrada e saída suaves de imagem e áudio.
- Títulos, importação de legendas SRT e notas de roteiro por cena.
- Histórico de até 50 operações, com agrupamento de arrastos e ajustes contínuos.
- Painéis e timeline redimensionáveis no desktop, modo foco e gavetas de ferramentas no celular.

## Executar e validar

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
```

Teste de navegador (requer FFmpeg e Chromium):

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

`KIRO_BROWSER_PATH` permite indicar um executável já instalado. O teste gera mídias sintéticas, verifica três cenas, recuperação depois de recarregar, áudio e cores do arquivo exportado, cancelamento e layout de 390 px. Evidências ficam em `test-results/`. GitHub Actions executa a mesma validação.

## Limites desta versão

- Exportação em tempo real: mantenha a aba visível e o dispositivo ativo. Trocar de aba cancela a exportação para evitar um arquivo com ritmo incorreto. O desempenho e os codecs dependem do navegador/dispositivo; não há promessa de exportação determinística quadro a quadro.
- O armazenamento é local, sujeito à capacidade e à limpeza de dados do navegador. Mantenha os originais e baixe cópias da edição; não há sincronização em nuvem.
- Mídias são preparadas em memória por clipe. Projetos longos ou muitos vídeos simultâneos ainda precisam de gestão de memória/proxies antes de uso profissional intensivo.
- Entradas/saídas suaves e movimento inicial/final estão implementados; não há biblioteca completa de transições, curvas de keyframes, transcrição automática ou edição por IA.
- Não há login, cobrança, planos pagos, geração de animação por IA nem infraestrutura de nuvem nesta entrega.
- O manifest existe, mas não há service worker/offline completo nem build nativa Tauri configurada.

Veja `docs/ROADMAP.md` para as próximas etapas.
