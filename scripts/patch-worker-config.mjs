/**
 * Ajusta o wrangler.json gerado pelo build para a publicação autônoma do
 * portal.
 *
 * O build do vinext escreve `dist/server/wrangler.json` já com os campos que o
 * Worker precisa (assets, compatibilidade, regras de módulo). O que falta são
 * os recursos REAIS do portal: o banco D1 e o bucket R2 criados só para ele.
 * Este script troca os placeholders por esses valores — nada do site de
 * ecommerce é reaproveitado.
 */
import { readFileSync, writeFileSync } from "node:fs";

const configPath = process.argv[2] ?? "dist/server/wrangler.json";
const {
  PORTAL_WORKER_NAME: workerName = "diario-mello",
  PORTAL_D1_NAME: databaseName = "diario-mello",
  PORTAL_D1_ID: databaseId,
  PORTAL_R2_BUCKET: bucketName = "diario-mello-midia",
  // "0" quando o R2 ainda não está habilitado na conta: publicamos sem o
  // binding em vez de deixar o deploy inteiro falhar.
  PORTAL_R2_ENABLED: r2Enabled = "1",
} = process.env;

if (!databaseId) {
  console.error("PORTAL_D1_ID não definido: rode este script pelo scripts/publish-portal.sh.");
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));

config.name = workerName;
config.topLevelName = workerName;
config.workers_dev = true;
config.d1_databases = [{ binding: "DB", database_name: databaseName, database_id: databaseId }];
config.r2_buckets =
  r2Enabled === "0" ? [] : [{ binding: "BUCKET", bucket_name: bucketName }];

// O cron de 6 em 6 horas pertence ao painel de ecommerce (snapshots de
// tendências). Numa publicação só do portal ele não tem o que fazer.
delete config.triggers;

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

console.log(`Worker.......: ${workerName}`);
console.log(`Banco D1.....: ${databaseName} (${databaseId})`);
console.log(`Bucket R2....: ${r2Enabled === "0" ? "não habilitado (upload de imagem desligado)" : bucketName}`);
