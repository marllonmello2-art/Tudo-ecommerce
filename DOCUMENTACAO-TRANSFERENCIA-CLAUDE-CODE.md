# Tudo do Ecommerce — pacote para Claude Code

Este pacote contém o código-fonte da versão publicada do sistema Tudo do Ecommerce.

## Conteúdo

- `app/`: interface React/Next/Vinext e rotas de API.
- `app/api/trends/route.ts`: tendências, snapshots, atualização manual e leitura do D1.
- `db/`: schema Drizzle e inicialização das tabelas D1.
- `drizzle/`: migrations do banco, incluindo `trend_snapshots`.
- `worker/index.ts`: Worker Cloudflare, incluindo o cron automático.
- `lib/marketplaces.ts`: identificadores únicos dos marketplaces.
- `vite.config.ts`: bindings e Cron Trigger de 6 em 6 horas.
- `.openai/hosting.json`: identidade e bindings lógicos do Site.
- `README.md`: documentação original do projeto.

## Como executar

```bash
npm install
npm run build
npm test
npm run lint
```

## Variáveis e serviços necessários

Configure as credenciais somente no ambiente seguro do servidor:

- `SERPAPI_KEY`: Google Trends e busca de imagens.
- `OPENAI_API_KEY`: análise visual real dos produtos.
- `OPENAI_VISION_MODEL`: opcional; padrão `gpt-4o-mini`.

Bindings necessários:

- D1: `DB`.
- R2: `BUCKET`.

Não há chaves secretas incluídas neste pacote. Na última auditoria da produção, `SERPAPI_KEY` e `OPENAI_API_KEY` ainda não estavam cadastradas; por isso o sistema mostra configuração pendente em vez de inventar dados.

## Tendências

- O cron está configurado para executar a cada 6 horas: `0 */6 * * *`.
- Os resultados são persistidos na tabela `trend_snapshots`.
- A rota de leitura consulta os snapshots do D1, sem chamar a SerpApi a cada abertura da tela.
- O botão “Forçar atualização” executa uma coleta manual fora do cron.
- A interface exibe a idade do snapshot.
- Google Trends representa interesse relativo de busca, não vendas confirmadas.

## Observação para continuidade

Preserve os IDs estáveis dos marketplaces (`mercado-livre`, `shopee`, `shein`, `tiktok-shop`) e não substitua os estados de configuração pendente por dados fictícios.
