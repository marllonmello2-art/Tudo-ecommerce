# Publicar o Diário Mello

Este guia leva o portal ao ar na Cloudflare com **recursos próprios e vazios**:
um banco D1 novo (`diario-mello`) e um bucket de imagens novo
(`diario-mello-midia`), criados só para o portal. Nenhum dado, banco ou arquivo
de qualquer site anterior é reaproveitado.

## O que já está automatizado

`scripts/publish-portal.sh` faz tudo sozinho:

1. confere a credencial da Cloudflare;
2. cria o banco D1 e o bucket R2 do portal (se ainda não existirem);
3. compila o projeto;
4. aponta o Worker para esses recursos;
5. publica;
6. cadastra os secrets que faltarem, gerando chaves aleatórias.

As tabelas e o conteúdo inicial (as sete editorias, a redação e três matérias de
exemplo) são criados pelo próprio portal na primeira visita — não há passo de
migration para rodar à mão.

O workflow `.github/workflows/publicar-portal.yml` roda esse script a cada push
na branch principal, então depois da configuração inicial toda alteração vai ao
ar sozinha.

## O que só você pode fazer

Publicar exige uma credencial da sua conta Cloudflare, e essa credencial é sua —
ninguém mais pode criá-la por você. São três passos, uns dez minutos.

### Passo 1 — Ter uma conta Cloudflare

Se ainda não tem: <https://dash.cloudflare.com/sign-up>. O plano gratuito cobre
Workers, D1 e R2 no tamanho que este portal usa.

### Passo 2 — Criar o token de API e pegar o Account ID

1. Entre em <https://dash.cloudflare.com/profile/api-tokens>.
2. **Create Token** → role até o fim → **Create Custom Token** → *Get started*.
3. Dê um nome (ex.: `deploy-diario-mello`) e adicione **quatro permissões**:

   | Tipo | Permissão | Nível |
   | --- | --- | --- |
   | Account | Workers Scripts | Edit |
   | Account | D1 | Edit |
   | Account | Workers R2 Storage | Edit |
   | Account | Account Settings | Read |

4. Em **Account Resources**, escolha *Include* → a sua conta.
5. **Continue to summary** → **Create Token** → **copie o token agora**: ele só
   aparece uma vez.
6. O **Account ID** fica em <https://dash.cloudflare.com> → *Workers & Pages* →
   coluna da direita, "Account ID". Copie também.

### Passo 3 — Guardar os dois valores no GitHub

1. Abra <https://github.com/marllonmello2-art/Tudo-ecommerce/settings/secrets/actions>.
2. **New repository secret**, duas vezes:
   - `CLOUDFLARE_API_TOKEN` → o token do passo 2
   - `CLOUDFLARE_ACCOUNT_ID` → o Account ID
3. Opcional, para a publicação automatizada por IA:
   - `AGENT_API_KEY` → invente uma senha longa (ou deixe para depois; sem ela a
     rota `POST /api/publish` responde 503 e o resto do portal funciona normal).

### Passo 3.5 — Habilitar o R2 (opcional, para subir imagens)

O upload de capas usa o R2. Ele tem 10 GB gratuitos, mas a Cloudflare pede uma
ativação única em <https://dash.cloudflare.com> → **R2** → *Enable R2* (nessa
tela ela costuma pedir um cartão, mesmo sem cobrar no plano gratuito).

Não quer ativar agora? Pode pular: a publicação detecta que o R2 não está
disponível e **sobe o portal sem ele**. Tudo funciona, menos o botão de enviar
imagem — no editor você cola a URL da capa no campo "Ou cole uma URL". Quando
ativar o R2, é só publicar de novo que o bucket entra sozinho.

### Passo 4 — Disparar a publicação

O botão "Run workflow" só aparece depois que o arquivo do workflow estiver na
branch principal. Então escolha um caminho:

**Caminho A — juntar na branch principal (recomendado)**
Faça o merge da branch `claude/brave-curie-vfrlms` em `main`. O push já dispara
a publicação, e daí em diante todo commit em `main` republica sozinho.

**Caminho B — publicar do seu computador**
Com [Node.js 22+](https://nodejs.org) instalado, dentro da pasta do projeto:

```bash
npm install
npx wrangler login          # abre o navegador para você autorizar
bash scripts/publish-portal.sh
```

No fim ele imprime o endereço do portal e, se gerar a chave do agente, mostra
essa chave uma única vez — guarde num gerenciador de senhas.

### Passo 5 — Criar o seu acesso de editor

Abra `https://SEU-ENDERECO/admin`. Como ainda não existe nenhum usuário, a tela
oferece **"Criar acesso do editor"**: informe nome, e-mail e uma senha de pelo
menos 10 caracteres. Essa tela se fecha sozinha depois do primeiro cadastro — a
partir daí ela vira um login normal.

Depois disso, apague as três matérias de exemplo pelo painel e publique as suas.

## Depois de publicado

**Endereço.** O portal nasce em `https://diario-mello.SEU-SUBDOMINIO.workers.dev`.
Para usar um domínio próprio: dashboard → *Workers & Pages* → `diario-mello` →
*Settings* → *Domains & Routes* → *Add* → *Custom domain*. O domínio precisa
estar na sua conta Cloudflare.

**Chave do agente (GPT).** Com o `AGENT_API_KEY` cadastrado, o schema para
Actions de um GPT customizado fica em `https://SEU-ENDERECO/api/openapi.json`;
a autenticação é do tipo *API Key*, no header `x-agent-api-key`.

**Custos.** No plano gratuito da Cloudflare: 100 mil requisições por dia no
Worker, 5 GB no D1 e 10 GB no R2. Um portal começando fica bem dentro disso — o
R2 é o único que pede a ativação do passo 3.5.

## Se algo falhar

| Mensagem | O que fazer |
| --- | --- |
| `Nenhuma credencial da Cloudflare encontrada` | Faltam os secrets do passo 3 (ou rodar `npx wrangler login` no caminho B) |
| `Authentication error [code: 10000]` | O token não tem uma das quatro permissões do passo 2 — recrie o token |
| `Não consegui obter o id do banco D1` | O token está sem a permissão **D1 · Edit** |
| Portal no ar mas escrito "Banco de dados não conectado" | O deploy subiu sem o binding: rode a publicação de novo, ela reaponta o Worker |
| `Bucket R2 (BUCKET) não conectado` ao enviar imagem | O R2 não está habilitado na conta (passo 3.5) — enquanto isso, cole a URL da capa |
