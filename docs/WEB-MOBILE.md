# Arquitetura web e mobile — 0.5

`history.ts` mantém histórico puro, sem atualizações de estado dentro de reducers. `operations.ts` contém as regras de corte, velocidade, divisão, remoção e importação SRT. `storage.ts` mantém a edição e os blobs em IndexedDB; URLs temporárias são recriadas ao abrir.

`engine.ts` compõe imagens, vídeos e texto em canvas e mistura o áudio com Web Audio. A mesma composição é usada pela prévia e pela exportação MediaRecorder. O relógio da timeline é independente da seleção de clipes. O navegador escolhe um formato de gravação suportado, mostrado antes de exportar.

A prévia permite qualidade reduzida sem alterar o tamanho do arquivo final. No desktop, biblioteca e timeline têm divisórias redimensionáveis. No celular, biblioteca e propriedades abrem como gavetas sobre a prévia.

Não há tráfego de mídia para um servidor. Limpeza do navegador ou modo privado podem remover os dados. A interface distingue cópia de projeto da exportação do vídeo final. Projetos legados sem mídia exibem reconexão explícita.

O código de nuvem, autenticação, pagamentos, geração de mídia e renderização remota permanece fora desta versão. Uma futura implementação deve manter a composição e o modelo de projeto como contrato compartilhado, com validação e migrações explícitas.
