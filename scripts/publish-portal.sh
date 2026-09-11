#!/usr/bin/env bash
#
# Publica o Diário Mello na Cloudflare de ponta a ponta, do zero.
#
# O que ele faz sozinho:
#   1. confere se há credencial da Cloudflare;
#   2. cria (ou reaproveita) o banco D1 e o bucket R2 EXCLUSIVOS do portal;
#   3. compila o projeto;
#   4. aponta o Worker para esses recursos novos;
#   5. publica;
#   6. cadastra os secrets que ainda não existirem, gerando chaves aleatórias.
#
# O portal cria as próprias tabelas e o conteúdo inicial na primeira visita,
# então não existe passo de migration obrigatório. Nenhum dado de outro site é
# usado: banco e bucket nascem vazios.
#
# Uso local:   wrangler login && bash scripts/publish-portal.sh
# Uso em CI:   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... bash scripts/publish-portal.sh
set -euo pipefail

WORKER_NAME="${PORTAL_WORKER_NAME:-diario-mello}"
D1_NAME="${PORTAL_D1_NAME:-diario-mello}"
R2_BUCKET="${PORTAL_R2_BUCKET:-diario-mello-midia}"
CONFIG="dist/server/wrangler.json"

export PORTAL_WORKER_NAME="$WORKER_NAME"
export PORTAL_D1_NAME="$D1_NAME"
export PORTAL_R2_BUCKET="$R2_BUCKET"

wrangler() { npx --yes wrangler@4 "$@"; }

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------- credenciais
step "Conferindo o acesso à Cloudflare"
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  if ! wrangler whoami >/dev/null 2>&1; then
    cat >&2 <<'MSG'
Nenhuma credencial da Cloudflare encontrada.

  - No seu computador:  npx wrangler login
  - Em automação (CI):  defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID

MSG
    exit 1
  fi
fi
echo "Credencial encontrada."

# ------------------------------------------------------------------ banco D1
step "Garantindo o banco D1 \"$D1_NAME\""
D1_LIST="$(wrangler d1 list --json 2>/dev/null || echo '[]')"
D1_ID="$(
  D1_NAME="$D1_NAME" node -e '
    const list = JSON.parse(process.argv[1] || "[]");
    const found = list.find((db) => db.name === process.env.D1_NAME);
    process.stdout.write(found?.uuid ?? found?.database_id ?? "");
  ' "$D1_LIST"
)"

if [[ -z "$D1_ID" ]]; then
  echo "Não existe ainda — criando."
  wrangler d1 create "$D1_NAME" >/dev/null
  D1_LIST="$(wrangler d1 list --json)"
  D1_ID="$(
    D1_NAME="$D1_NAME" node -e '
      const list = JSON.parse(process.argv[1] || "[]");
      const found = list.find((db) => db.name === process.env.D1_NAME);
      process.stdout.write(found?.uuid ?? found?.database_id ?? "");
    ' "$D1_LIST"
  )"
fi

if [[ -z "$D1_ID" ]]; then
  echo "Não consegui obter o id do banco D1 \"$D1_NAME\"." >&2
  exit 1
fi
export PORTAL_D1_ID="$D1_ID"
echo "Banco pronto: $D1_NAME ($D1_ID)"

# ----------------------------------------------------------------- bucket R2
step "Garantindo o bucket R2 \"$R2_BUCKET\""
if wrangler r2 bucket info "$R2_BUCKET" >/dev/null 2>&1; then
  echo "Bucket já existe."
else
  # `bucket create` falha se o bucket já existir; a mensagem é informativa.
  wrangler r2 bucket create "$R2_BUCKET" || echo "Bucket já existente ou criado por outra execução."
fi

# --------------------------------------------------------------------- build
step "Compilando o portal"
bash scripts/sites-env.sh -- ./node_modules/.bin/vinext build
bash scripts/validate-artifact.sh

step "Apontando o Worker para os recursos do portal"
node scripts/patch-worker-config.mjs "$CONFIG"

# ------------------------------------------------------------------- deploy
step "Publicando na Cloudflare"
DEPLOY_LOG="$(mktemp)"
wrangler deploy -c "$CONFIG" | tee "$DEPLOY_LOG"

# --------------------------------------------------------------------- secrets
step "Conferindo os secrets do Worker"
EXISTING="$(wrangler secret list --name "$WORKER_NAME" 2>/dev/null || echo 'ilegivel')"

# Responde 0 (existe), 1 (não existe) ou 2 (não consegui ler a lista).
has_secret() {
  node -e '
    let list;
    try { list = JSON.parse(process.argv[1]); } catch { process.exit(2); }
    if (!Array.isArray(list)) process.exit(2);
    process.exit(list.some((item) => item?.name === process.argv[2]) ? 0 : 1);
  ' "$EXISTING" "$1"
}

random_key() { node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))'; }

set +e
has_secret ADMIN_SESSION_SECRET
SESSION_SECRET_STATE=$?
has_secret AGENT_API_KEY
AGENT_KEY_STATE=$?
set -e

# Trocar o ADMIN_SESSION_SECRET derruba quem está logado, então só criamos
# quando temos certeza de que ele não existe. Sem ele o portal usa um segredo
# aleatório próprio, guardado na tabela portal_settings — também seguro.
if [[ "$SESSION_SECRET_STATE" == "1" ]]; then
  echo "ADMIN_SESSION_SECRET: gerando uma chave aleatória."
  random_key | wrangler secret put ADMIN_SESSION_SECRET --name "$WORKER_NAME"
else
  echo "ADMIN_SESSION_SECRET: mantido como está."
fi

GENERATED_AGENT_KEY=""
if [[ -n "${AGENT_API_KEY:-}" ]]; then
  echo "AGENT_API_KEY: usando a chave informada pelo ambiente."
  printf '%s' "$AGENT_API_KEY" | wrangler secret put AGENT_API_KEY --name "$WORKER_NAME"
elif [[ "$AGENT_KEY_STATE" == "0" ]]; then
  echo "AGENT_API_KEY: já configurado (mantido)."
elif [[ -n "${CI:-}" ]]; then
  # Em CI o log fica gravado: gerar a chave aqui significaria imprimi-la num
  # lugar que outras pessoas leem. Melhor deixar o dono cadastrar.
  echo "AGENT_API_KEY: não configurado. Cadastre o secret AGENT_API_KEY no"
  echo "  repositório (Settings > Secrets and variables > Actions) e rode de novo."
  echo "  Até lá, POST /api/publish responde 503 — o resto do portal funciona."
else
  GENERATED_AGENT_KEY="$(random_key)"
  printf '%s' "$GENERATED_AGENT_KEY" | wrangler secret put AGENT_API_KEY --name "$WORKER_NAME"
fi

# ---------------------------------------------------------------- resultado
URL="$(grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | head -1 || true)"
rm -f "$DEPLOY_LOG"

printf '\n\033[1m==> Publicado\033[0m\n'
[[ -n "$URL" ]] && echo "Endereço do portal: $URL"
[[ -n "$URL" ]] && echo "Painel do editor..: $URL/admin"
echo
echo "Abra /admin e crie o primeiro acesso (e-mail e senha) — o portal ainda"
echo "não tem nenhum usuário, e essa tela se fecha sozinha depois do cadastro."

if [[ -n "$GENERATED_AGENT_KEY" ]]; then
  printf '\n\033[1mGuarde agora a chave do agente (ela não será exibida de novo):\033[0m\n'
  echo "  x-agent-api-key: $GENERATED_AGENT_KEY"
fi
