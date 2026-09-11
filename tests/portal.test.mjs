import assert from "node:assert/strict";
import test from "node:test";

/**
 * Testes do portal Diário Mello rodando contra o Worker construído.
 * Sem bindings D1/R2 — o site precisa responder mesmo assim, com as telas de
 * "banco não conectado" e com as rotas de API devolvendo erro explicado.
 */

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const ctx = { waitUntil() {}, passThroughOnException() {} };
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };

const call = (path, init) => worker.fetch(new Request(`http://localhost${path}`, init), env, ctx);

test("a capa exibe a marca do portal", async () => {
  const response = await call("/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Diário/);
  assert.match(html, /Mello/);
  assert.match(html, /Jornalismo independente/);
});

test("robots.txt aponta o sitemap e bloqueia o painel", async () => {
  const response = await call("/robots.txt");
  assert.equal(response.status, 200);

  const body = await response.text();
  assert.match(body, /Sitemap: http:\/\/localhost\/sitemap\.xml/);
  assert.match(body, /Disallow: \/admin/);
});

test("sitemap.xml é XML válido mesmo sem banco", async () => {
  const response = await call("/sitemap.xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/xml/);
  assert.match(await response.text(), /<urlset/);
});

test("/api/publish recusa chamadas sem a chave do agente", async () => {
  const response = await call("/api/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Teste", content: "Corpo" }),
  });

  // Sem AGENT_API_KEY configurada o endpoint responde 503; com a chave
  // configurada e ausente no header, responderia 401. Nunca 2xx.
  assert.ok([401, 503].includes(response.status));
  const data = await response.json();
  assert.match(data.code, /AGENT_KEY_NOT_CONFIGURED|INVALID_AGENT_KEY/);
});

test("/api/openapi.json descreve a rota de publicação", async () => {
  const response = await call("/api/openapi.json");
  assert.equal(response.status, 200);

  const schema = await response.json();
  assert.equal(schema.openapi, "3.1.0");
  assert.ok(schema.paths["/api/publish"].post);
  assert.equal(schema.components.securitySchemes.agentApiKey.name, "x-agent-api-key");
});

test("a newsletter valida o e-mail antes de tocar no banco", async () => {
  const response = await call("/api/newsletter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "nao-e-email" }),
  });
  assert.equal(response.status, 400);
});

test("as rotas do painel exigem sessão", async () => {
  const response = await call("/admin", { headers: { accept: "text/html" }, redirect: "manual" });
  assert.ok([302, 303, 307].includes(response.status));
  assert.match(response.headers.get("location") ?? "", /\/admin\/login/);
});

test("a área de ecommerce continua disponível em /marketlab", async () => {
  const response = await call("/marketlab", {
    headers: {
      accept: "text/html",
      "oai-authenticated-user-email": "teste@example.com",
    },
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Tudo do Ecommerce|Venda melhor/);
});
