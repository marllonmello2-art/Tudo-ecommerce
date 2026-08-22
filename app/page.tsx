"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSessionUser } from "./session-context";
import { marketplaceIdFromName } from "../lib/marketplaces";

type Platform = "Mercado Livre" | "Shopee" | "SHEIN" | "TikTok Shop";
type Tab = "anuncio" | "tendencias" | "precificacao";

const platforms: { name: Platform; mark: string; url: string }[] = [
  { name: "Shopee", mark: "S", url: "https://shopee.com.br/search?keyword=" },
  { name: "Mercado Livre", mark: "M", url: "https://lista.mercadolivre.com.br/" },
  { name: "SHEIN", mark: "S", url: "https://br.shein.com/pdsearch/" },
  { name: "TikTok Shop", mark: "♪", url: "https://shop.tiktok.com/" },
];

const marketplaceData: Record<Platform, {
  eyebrow: string; headline: string; fee: number; fixed: number;
}> = {
  Shopee: {
    eyebrow: "PAINEL SHOPEE", headline: "Venda melhor na Shopee", fee: 14, fixed: 4,
  },
  "Mercado Livre": {
    eyebrow: "PAINEL MERCADO LIVRE", headline: "Venda melhor no Mercado Livre", fee: 16, fixed: 6,
  },
  SHEIN: {
    eyebrow: "PAINEL SHEIN", headline: "Venda melhor na SHEIN", fee: 18, fixed: 4,
  },
  "TikTok Shop": {
    eyebrow: "PAINEL TIKTOK SHOP", headline: "Venda melhor no TikTok Shop", fee: 10, fixed: 6,
  },
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const MAX_UPLOAD_DIMENSION = 1600;

async function prepareImageForUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / longestSide);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem para envio.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let compressed: Blob | null = null;
    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42, 0.34]) {
      compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (compressed && compressed.size <= MAX_UPLOAD_BYTES) break;
    }
    if (!compressed || compressed.size > MAX_UPLOAD_BYTES) {
      throw new Error("Não foi possível reduzir a imagem para o limite seguro de envio.");
    }
    const baseName = file.name.replace(/\.[^/.]+$/, "") || "produto";
    return new File([compressed], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

type ProductAnalysis = {
  identifiedAs: string;
  confidence: string;
  ean?: string;
  title: string;
  description: string;
  bullets: string[];
  technicalSheet: { label: string; value: string }[];
  fiscal: { ncm: string; ncmNote: string; cest: string; cestNote: string };
  price: { minimum: number; average: number; maximum: number; note: string };
  analysisSource?: "vision" | "fallback";
  analysisNote?: string;
};

type ProductProfile = Omit<ProductAnalysis, "title" | "price"> & {
  keywords: string[];
  title: string;
  price: { minimum: number; average: number; maximum: number; note: string };
};

const productProfiles: ProductProfile[] = [
  {
    keywords: ["navalha", "sobrancelha", "lamina", "lâmina"],
    identifiedAs: "Kit de navalhas para sobrancelhas",
    confidence: "média — confirme marca, quantidade e material",
    ean: "7908142703454",
    title: "Kit de Navalhas para Sobrancelhas com Lâmina de Precisão",
    description: "Realce o desenho das sobrancelhas com praticidade e precisão. O kit é compacto, fácil de transportar e ideal para o cuidado diário e para acabamento dos pelos faciais.",
    bullets: ["Lâmina de precisão para acabamento delicado", "Cabo leve e fácil de manusear", "Formato compacto para levar na bolsa ou nécessaire", "Indicado para uso pessoal e rotina de beleza"],
    technicalSheet: [{ label: "Categoria", value: "Beleza e cuidados pessoais" }, { label: "Aplicação", value: "Acabamento de sobrancelhas" }, { label: "Conteúdo", value: "3 navalhas individuais" }, { label: "Cores", value: "Rosa, azul claro e amarelo" }, { label: "Medidas", value: "14,5 cm × 3,5 cm" }, { label: "Material", value: "Plástico e lâmina metálica · confirmar" }],
    fiscal: { ncm: "8214.90.00", ncmNote: "Sugestão para instrumento manual de cuidado pessoal; confirme a classificação do produto completo.", cest: "Não identificado", cestNote: "Não presumir CEST sem validar a operação, o estado e a descrição fiscal." },
    price: { minimum: 12.9, average: 24.9, maximum: 39.9, note: "Faixa inicial de referência para anúncios semelhantes; validar na plataforma selecionada." },
  },
  {
    keywords: ["organizador", "caixa", "multiuso", "gaveta"],
    identifiedAs: "Organizador multiuso compacto",
    confidence: "média — confirme material, medidas e quantidade",
    title: "Organizador Multiuso Compacto para Casa, Escritório e Viagem",
    description: "Mantenha pequenos objetos sempre no lugar com um organizador compacto e versátil. Uma solução prática para gavetas, mesa de trabalho, banheiro, quarto e viagens.",
    bullets: ["Ajuda a aproveitar melhor pequenos espaços", "Uso versátil em diferentes ambientes", "Fácil de limpar e transportar", "Ideal para acessórios, materiais de escritório e itens pessoais"],
    technicalSheet: [{ label: "Categoria", value: "Casa e organização" }, { label: "Uso", value: "Organização de pequenos objetos" }, { label: "Material", value: "A confirmar pela foto" }, { label: "Medidas", value: "Informar no anúncio" }],
    fiscal: { ncm: "3924.90.00", ncmNote: "Sugestão para artigo doméstico de plástico; confirme o material e a função principal.", cest: "Não identificado", cestNote: "A existência de CEST depende do enquadramento fiscal e da operação." },
    price: { minimum: 19.9, average: 34.9, maximum: 59.9, note: "Faixa inicial de referência; atualizar com anúncios atuais antes de publicar." },
  },
  {
    keywords: ["capinha", "capa", "celular", "fone", "carregador"],
    identifiedAs: "Acessório para celular",
    confidence: "média — confirme modelo e compatibilidade",
    title: "Acessório para Celular com Proteção, Praticidade e Acabamento Moderno",
    description: "Tenha mais praticidade e proteção para o seu celular com um acessório pensado para a rotina. Confira o modelo compatível antes da compra.",
    bullets: ["Compatibilidade deve ser conferida pelo modelo", "Design prático para uso diário", "Leve e fácil de transportar", "Ideal para reposição ou presente"],
    technicalSheet: [{ label: "Categoria", value: "Acessórios para celular" }, { label: "Compatibilidade", value: "Informar modelo" }, { label: "Material", value: "A confirmar pela embalagem" }, { label: "Cor", value: "A confirmar na foto" }],
    fiscal: { ncm: "3926.90.90", ncmNote: "Sugestão genérica para outros artefatos de plástico; pode mudar conforme o tipo exato do acessório.", cest: "Não identificado", cestNote: "Validar CEST conforme produto, operação e legislação vigente." },
    price: { minimum: 14.9, average: 29.9, maximum: 79.9, note: "Faixa inicial de referência; confirmar preço e concorrência por modelo." },
  },
];

function inferProductProfile(fileName: string) {
  const normalized = fileName.toLocaleLowerCase("pt-BR");
  return productProfiles.find((profile) => profile.keywords.some((keyword) => normalized.includes(keyword))) ?? {
    keywords: [], identifiedAs: "Produto para venda online", confidence: "baixa — revise os dados antes de publicar", title: "Produto identificado pela foto — complete os dados do anúncio", description: "A imagem foi recebida e organizada para criação do anúncio. Revise marca, modelo, material, medidas e compatibilidade antes de publicar.", bullets: ["Título pronto para edição", "Descrição estruturada para marketplace", "Confirme as características na embalagem", "Revise a classificação fiscal antes da emissão"], technicalSheet: [{ label: "Categoria", value: "A confirmar" }, { label: "Marca", value: "A confirmar" }, { label: "Modelo", value: "A confirmar" }, { label: "Medidas", value: "Informar no anúncio" }], fiscal: { ncm: "A confirmar", ncmNote: "A foto sozinha não permite afirmar a classificação fiscal com segurança.", cest: "A confirmar", cestNote: "Não presumir CEST sem validar a NCM e a operação." }, price: { minimum: 0, average: 0, maximum: 0, note: "Informe o tipo do produto para gerar uma faixa de preço mais precisa." },
  };
}

async function analyzeProductWithVision(file: File, platform: Platform): Promise<ProductAnalysis> {
  const body = new FormData();
  body.append("image", file, file.name);
  body.append("platform", platform);
  const response = await fetch("/api/analyze-product", { method: "POST", body });
  let result: { analysis?: ProductAnalysis; error?: string } = {};
  try { result = await response.json() as { analysis?: ProductAnalysis; error?: string }; } catch { /* erro tratado abaixo */ }
  if (!response.ok || !result.analysis) throw new Error(result.error ?? "Não foi possível concluir a análise visual real.");
  return result.analysis;
}

async function fallbackVisionApi(file: File, platform: Platform, reason: string): Promise<ProductAnalysis> {
  const profile = inferProductProfile(file.name);
  const platformFactor = platform === "SHEIN" ? 1.08 : platform === "Mercado Livre" ? 1.04 : platform === "TikTok Shop" ? 0.98 : 1;
  await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
  return { ...profile, analysisSource: "fallback", analysisNote: `Fallback local usado porque a análise visual real não está disponível: ${reason}`, price: { ...profile.price, minimum: profile.price.minimum ? Number((profile.price.minimum * platformFactor).toFixed(2)) : 0, average: profile.price.average ? Number((profile.price.average * platformFactor).toFixed(2)) : 0, maximum: profile.price.maximum ? Number((profile.price.maximum * platformFactor).toFixed(2)) : 0, note: `${profile.price.note} Plataforma considerada: ${platform}.` } };
}

export default function Home() {
  const sessionUser = useSessionUser();
  const [platform, setPlatform] = useState<Platform>("Shopee");
  const [tab, setTab] = useState<Tab>("anuncio");
  const [fileName, setFileName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const analysisRequest = useRef(0);
  const [cost, setCost] = useState(12);
  const [margin, setMargin] = useState(35);
  const [fee, setFee] = useState(marketplaceData.Shopee.fee);
  const [fixed, setFixed] = useState(marketplaceData.Shopee.fixed);
  const [shipping, setShipping] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [persistenceNotice, setPersistenceNotice] = useState("");
  useEffect(() => {
    let active = true;
    async function restoreSavedState() {
      const localPhoto = window.localStorage.getItem("marketlab-profile-photo") ?? "";
      if (localPhoto) setProfilePhoto(localPhoto);
      try {
        const profileResponse = await fetch("/api/profile", { cache: "no-store" });
        const profile = await profileResponse.json() as { profile?: { photoUrl?: string | null } };
        if (active && profile.profile?.photoUrl) setProfilePhoto(profile.profile.photoUrl);
      } catch { /* fallback local continua disponível */ }
      try {
        const productResponse = await fetch("/api/products", { cache: "no-store" });
        const saved = await productResponse.json() as { product?: { analysis?: ProductAnalysis | null; imageUrl?: string | null }; ad?: { platform?: string } | null; error?: string };
        if (!active) return;
        if (!productResponse.ok) {
          if (saved.error) setPersistenceNotice(saved.error);
          return;
        }
        if (saved.product?.analysis) {
          setAnalysis(saved.product.analysis);
          setAnalyzed(true);
          if (saved.product.imageUrl) setImageUrl(saved.product.imageUrl);
          if (saved.ad?.platform && platforms.some((item) => item.name === saved.ad?.platform)) {
            const savedPlatform = saved.ad.platform as Platform;
            setPlatform(savedPlatform); setFee(marketplaceData[savedPlatform].fee); setFixed(marketplaceData[savedPlatform].fixed);
          }
          if (!saved.product.imageUrl) setPersistenceNotice("Produto restaurado, mas a imagem original ainda não está disponível no armazenamento de arquivos.");
        }
      } catch { /* primeira abertura continua utilizável mesmo sem persistência */ }
    }
    void restoreSavedState();
    return () => { active = false; };
  }, [sessionUser.email]);
  const current = marketplaceData[platform];
  const recommendedPrice = useMemo(() => {
    const denominator = Math.max(0.1, 1 - fee / 100 - margin / 100);
    return (cost + fixed + shipping) / denominator;
  }, [cost, fee, fixed, margin, shipping]);
  const net = recommendedPrice * (1 - fee / 100) - fixed - shipping;
  const profit = net - cost;

  function selectPlatform(value: Platform) {
    setPlatform(value); setFee(marketplaceData[value].fee); setFixed(marketplaceData[value].fixed);
  }
  async function runProductAnalysis(file: File) {
    const requestId = ++analysisRequest.current;
    setIsAnalyzing(true);
    setAnalyzed(false);
    setAnalysis(null);
    setAnalysisError("");
    try {
      const uploadFile = await prepareImageForUpload(file);
      if (requestId !== analysisRequest.current) return;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setUploadedFile(uploadFile);
      setImageUrl(URL.createObjectURL(uploadFile));
      let result: ProductAnalysis;
      try {
        result = await analyzeProductWithVision(uploadFile, platform);
      } catch (error) {
        result = await fallbackVisionApi(uploadFile, platform, error instanceof Error ? error.message : "erro não identificado");
      }
      if (requestId !== analysisRequest.current) return;
      setAnalysis(result);
      setAnalyzed(true);
      void persistProduct(result, uploadFile);
    } catch (error) {
      if (requestId !== analysisRequest.current) return;
      setAnalysisError(error instanceof Error ? error.message : "Não foi possível analisar a imagem.");
    } finally {
      if (requestId === analysisRequest.current) setIsAnalyzing(false);
    }
  }
  async function validateImageFile(file: File) {
    if (file.size > 10 * 1024 * 1024) return "A imagem excede o limite de 10 MB.";
    if (file.type && !["image/jpeg", "image/png"].includes(file.type)) return "Use somente uma imagem JPG/JPEG ou PNG.";
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if ((!isPng && !isJpeg) || (isPng && file.type && file.type !== "image/png") || (isJpeg && file.type && file.type !== "image/jpeg")) return "O conteúdo do arquivo não corresponde a um JPG/PNG válido.";
    try {
      const bitmap = await createImageBitmap(file);
      const validResolution = bitmap.width >= 500 && bitmap.height >= 500;
      bitmap.close();
      if (!validResolution) return "Use uma imagem com pelo menos 500 × 500 pixels para melhorar a análise.";
    } catch {
      return "Não foi possível ler a resolução da imagem. Escolha outro arquivo JPG ou PNG.";
    }
    return "";
  }
  async function loadFile(file?: File) {
    if (!file) return;
    try {
      const validationError = await validateImageFile(file);
      if (validationError) { setAnalysisError(validationError); return; }
    } catch {
      setAnalysisError("Não foi possível validar a imagem enviada.");
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setFileName(file.name); setUploadedFile(file); setImageUrl(URL.createObjectURL(file));
    void runProductAnalysis(file);
  }
  async function persistProduct(result: ProductAnalysis, file: File) {
    const body = new FormData();
    body.append("analysis", JSON.stringify(result));
    body.append("platform", platform);
    body.append("image", file, file.name);
    try {
      const response = await fetch("/api/products", { method: "POST", body });
      const payload = await response.json() as { code?: string; error?: string; saved?: boolean };
      if (!response.ok) setPersistenceNotice(payload.error ?? "Não foi possível salvar o produto e o anúncio.");
      else if (response.ok) setPersistenceNotice("");
    } catch { setPersistenceNotice("Não foi possível salvar este produto agora; a análise continua disponível neste dispositivo."); }
  }
  async function loadProfilePhoto(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const value = String(reader.result);
      setProfilePhoto(value); window.localStorage.setItem("marketlab-profile-photo", value); setAccountOpen(false);
      const body = new FormData(); body.append("photo", file, file.name);
      try {
        const response = await fetch("/api/profile", { method: "POST", body });
        const payload = await response.json() as { photoUrl?: string | null; error?: string };
        if (response.ok && payload.photoUrl) setProfilePhoto(payload.photoUrl);
        else if (!response.ok && payload.error) setPersistenceNotice(payload.error);
      } catch { setPersistenceNotice("A foto foi mantida neste navegador, mas ainda não foi salva entre dispositivos."); }
    };
    reader.readAsDataURL(file);
  }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) { void loadFile(event.target.files?.[0]); }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); void loadFile(event.dataTransfer.files?.[0]); }
  function analyze() { if (uploadedFile) void runProductAnalysis(uploadedFile); }
  function replaceImage() { analysisRequest.current += 1; if (imageUrl) URL.revokeObjectURL(imageUrl); setFileName(""); setImageUrl(""); setUploadedFile(null); setAnalyzed(false); setAnalysis(null); setAnalysisError(""); setIsAnalyzing(false); }
  async function savePricingSimulation() {
    try {
      const response = await fetch("/api/pricing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform, cost, margin, fee, fixed, shipping, recommendedPrice, net, profit }) });
      const payload = await response.json() as { error?: string };
      setPersistenceNotice(response.ok ? "Simulação salva no histórico." : payload.error ?? "Não foi possível salvar a simulação.");
    } catch { setPersistenceNotice("Não foi possível salvar a simulação agora."); }
    window.setTimeout(() => setPersistenceNotice(""), 3200);
  }
  const isProcessing = tab === "anuncio" && analyzed && Boolean(analysis) && Boolean(imageUrl);

  return (
    <main className={isProcessing ? "app-shell processing-shell" : "app-shell"}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">⌁</span><span>Tudo do <span>Ecommerce</span></span></div>
        <div className="workspace-label">CENTRAL DE VENDAS</div>
        <nav className="nav-list" aria-label="Navegação principal">
          <button className={tab === "anuncio" ? "nav-item active" : "nav-item"} onClick={() => setTab("anuncio")}><span>✦</span> Criar anúncio</button>
          <button className={tab === "tendencias" ? "nav-item active" : "nav-item"} onClick={() => setTab("tendencias")}><span>↗</span> Tendências</button>
          <button className={tab === "precificacao" ? "nav-item active" : "nav-item"} onClick={() => setTab("precificacao")}><span>◈</span> Precificação</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-card"><span className="sync-dot" /> Status das fontes<br /><small>Verificado ao abrir Tendências</small></div>
          <button className="help-link"><span>?</span> Central de ajuda</button>
          <div className="profile-wrap">
            <button className="profile" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} aria-label="Abrir menu da conta">
              {profilePhoto ? <img className="avatar avatar-photo" src={profilePhoto} alt="Foto de perfil" /> : <div className="avatar">MS</div>}
              <span className="profile-copy"><strong>{sessionUser.displayName}</strong><small>{sessionUser.email}</small></span><span className="more">•••</span>
            </button>
            {accountOpen && <div className="account-menu">
              <div className="account-menu-head"><span className="account-menu-label">CONTA MARKETLAB</span><strong>{sessionUser.displayName}</strong><small>{sessionUser.email}</small></div>
              <label className="account-menu-item"><span className="menu-icon">◉</span>Alterar foto de perfil<input type="file" accept="image/png,image/jpeg" onChange={(e) => loadProfilePhoto(e.target.files?.[0])} /></label>
              <a className="account-menu-item" href="/signin-with-chatgpt?return_to=/"><span className="menu-icon">↗</span>Entrar no sistema</a>
              <a className="account-menu-item danger" href="/signout-with-chatgpt?return_to=/"><span className="menu-icon">↪</span>Sair da conta</a>
            </div>}
          </div>
        </div>
      </aside>
      <section className={isProcessing ? "content processing-content" : "content"}>
        {persistenceNotice && <div className="persistence-banner">{persistenceNotice}</div>}
        <header className={isProcessing ? "topbar processing-chrome" : "topbar"}>
          <div><div className="breadcrumb">Workspace / <strong>{platform}</strong></div><h1>{current.headline}</h1></div>
          <div className="top-actions"><button className="icon-button" aria-label="Notificações">♢<i /></button><div className="marketplace-picker"><span className="platform-label">LOJA ATIVA</span><div className="picker-current"><span className={`market-mark mark-${platform.replaceAll(" ", "-").toLowerCase()}`}>{platforms.find((item) => item.name === platform)?.mark}</span><select value={platform} onChange={(e) => selectPlatform(e.target.value as Platform)} aria-label="Selecionar loja">{platforms.map((item) => <option key={item.name}>{item.name}</option>)}</select><span className="picker-status">● selecionada</span><span className="select-chevron">⌄</span></div></div></div>
        </header>
        <div className={isProcessing ? "tabs processing-chrome" : "tabs"} role="tablist">
          <button className={tab === "anuncio" ? "tab active" : "tab"} onClick={() => setTab("anuncio")}>Criar anúncio <span className="tab-count">01</span></button>
          <button className={tab === "tendencias" ? "tab active" : "tab"} onClick={() => setTab("tendencias")}>Tendências <span className="new-pill">NOVO</span></button>
          <button className={tab === "precificacao" ? "tab active" : "tab"} onClick={() => setTab("precificacao")}>Simulador de preço</button>
        </div>
        {tab === "anuncio" && (isProcessing && analysis ? <MarketLabProcessingDashboard imageUrl={imageUrl} analysis={analysis} profilePhoto={profilePhoto} onReplaceImage={replaceImage} /> : <AnnouncementView imageUrl={imageUrl} fileName={fileName} analyzed={analyzed} isAnalyzing={isAnalyzing} analysis={analysis} analysisError={analysisError} onDrop={onDrop} onFileChange={onFileChange} analyze={analyze} platform={platform} current={current} />)}
        {tab === "tendencias" && <TrendsView platform={platform} current={current} />}
        {tab === "precificacao" && <PricingView platform={platform} cost={cost} setCost={setCost} margin={margin} setMargin={setMargin} fee={fee} setFee={setFee} fixed={fixed} setFixed={setFixed} shipping={shipping} setShipping={setShipping} recommendedPrice={recommendedPrice} net={net} profit={profit} onSave={() => void savePricingSimulation()} />}
      </section>
    </main>
  );
}

function AnnouncementView({ imageUrl, fileName, analyzed, isAnalyzing, analysis, analysisError, onDrop, onFileChange, analyze, platform, current }: { imageUrl: string; fileName: string; analyzed: boolean; isAnalyzing: boolean; analysis: ProductAnalysis | null; analysisError: string; onDrop: (event: DragEvent<HTMLDivElement>) => void; onFileChange: (event: ChangeEvent<HTMLInputElement>) => void; analyze: () => void; platform: Platform; current: typeof marketplaceData[Platform] }) {
  return <>
    <div className="hero-grid">
      <div className="upload-card">
        <div className="section-kicker"><span className="step-number">01</span><span>FOTO DO PRODUTO</span><span className="required">Obrigatório</span></div>
        <div className={imageUrl ? "dropzone has-image" : "dropzone"} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          {imageUrl ? <><img src={imageUrl} alt="Pré-visualização do produto" />{isAnalyzing ? <div className="analysis-loading-overlay"><span className="loading-spinner" /> <strong>Analisando produto com IA...</strong></div> : <div className="image-overlay"><label htmlFor="product-image">Trocar imagem</label></div>}</> : <><div className="upload-icon">↑</div><strong>Arraste a foto do produto aqui</strong><span>ou <label htmlFor="product-image">selecione do computador</label></span><small>JPG ou PNG · até 10 MB</small></>}
          <input id="product-image" type="file" accept="image/png,image/jpeg" onChange={onFileChange} />
        </div>
        {fileName && <div className="file-line"><span>◉</span>{fileName}<button onClick={() => window.location.reload()}>Remover</button></div>}
        <button className="primary-button full" onClick={analyze} disabled={!imageUrl || isAnalyzing}>{isAnalyzing ? "Analisando produto com IA..." : analyzed ? "Atualizar análise" : "Analisar produto"}<span>→</span></button>
        <div className="privacy-note">⌁ Sua imagem é usada somente para preparar este anúncio.</div>
      </div>
      <div className="insight-panel">
        <div className="insight-header"><div><div className="eyebrow">{current.eyebrow}</div><h2>O que você vai receber</h2></div><div className="sparkle">✦</div></div>
        <div className="deliverables"><div><span>⌁</span><div><strong>Imagens comerciais</strong><p>Capa, detalhes, medidas e variações prontas para publicar.</p></div></div><div><span>Aa</span><div><strong>Texto que vende</strong><p>Título otimizado, descrição e palavras-chave do produto.</p></div></div><div><span>⌘</span><div><strong>Dados fiscais</strong><p>NCM, CEST e informações técnicas para conferir.</p></div></div><div><span>↗</span><div><strong>Preço inteligente</strong><p>Comparação com anúncios atuais da {platform}.</p></div></div></div>
        <div className="accuracy-note"><span>i</span><p>A classificação fiscal é uma sugestão inicial. Confirme NCM e CEST na nota fiscal ou com seu contador.</p></div>
      </div>
    </div>
    <div className="section-heading"><div><div className="eyebrow">RESULTADO DA ANÁLISE</div><h2>Seu anúncio aparece aqui</h2></div><span className="live-chip"><i /> Pesquisa {platform}</span></div>
    {isAnalyzing ? <div className="analysis-loading-result"><span className="loading-spinner" /><div><strong>Analisando produto com IA...</strong><p>Estamos identificando o produto e preparando título, descrição, ficha técnica, NCM, CEST e faixa de preço.</p></div></div> : analysisError ? <div className="analysis-error-result"><strong>Não foi possível concluir a análise</strong><p>{analysisError}</p><button className="outline-button" onClick={analyze}>Tentar novamente</button></div> : analyzed && analysis ? <ProductResult imageUrl={imageUrl} analysis={analysis} platform={platform} /> : <div className="empty-result"><div className="empty-art">✦</div><div><strong>Envie uma foto para começar</strong><p>Você verá título, descrição, ficha técnica, informações fiscais e faixa de preço nesta área.</p></div></div>}
  </>;
}

type CommercialScene = "technical" | "lifestyle" | "angles" | "bathroom";
type ProductImageResult = { imageUrl: string; sourceUrl: string; title: string; position: number };
type CommercialVariant = { label: string; description: string; imageUrl: string; prompt: string; scene: CommercialScene; sourceUrl?: string; sourceTitle?: string; dataUrl?: string };

/** Busca imagens comerciais no backend, sem expor a credencial do provedor ao navegador. */
async function searchProductImages(productName: string, productEAN: string): Promise<ProductImageResult[]> {
  if (!productName.trim()) throw new Error("O nome do produto é necessário para buscar imagens.");
  const params = new URLSearchParams({ productName: productName.trim() });
  if (productEAN.trim()) params.set("productEAN", productEAN.trim());
  const response = await fetch(`/api/product-images?${params.toString()}`, { cache: "no-store" });
  let result: { images?: ProductImageResult[]; error?: string } = {};
  try { result = await response.json() as { images?: ProductImageResult[]; error?: string }; } catch { /* erro tratado pela resposta HTTP abaixo */ }
  if (!response.ok) throw new Error(result.error ?? "Não foi possível buscar imagens comerciais na web.");
  return (result.images ?? []).slice(0, 4);
}

const commercialSceneMeta: { label: string; description: string; prompt: string; scene: CommercialScene }[] = [
  { label: "Medidas e ficha técnica", description: "Resultado encontrado para o produto identificado", prompt: "imagem comercial de catálogo para ficha técnica", scene: "technical" },
  { label: "Lifestyle e uso prático", description: "Resultado encontrado em contexto de uso", prompt: "imagem comercial de lifestyle do produto", scene: "lifestyle" },
  { label: "Galeria de ângulos multicor", description: "Resultado encontrado para conferência visual", prompt: "imagem comercial do produto em estúdio", scene: "angles" },
  { label: "Cenário ambientado · banheiro", description: "Resultado encontrado em cenário ambientado", prompt: "imagem comercial ambientada do produto", scene: "bathroom" },
];

function toCommercialVariants(images: ProductImageResult[]): CommercialVariant[] {
  return images.slice(0, 4).map((image, index) => ({ ...commercialSceneMeta[index], imageUrl: image.imageUrl, sourceUrl: image.sourceUrl, sourceTitle: image.title, prompt: `${commercialSceneMeta[index].prompt}; busca web: ${image.title}` }));
}

async function fetchDownloadableImage(sourceUrl: string) {
  const converted = await fetch("/api/convert-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: sourceUrl }) });
  if (converted.ok) return { blob: await converted.blob(), extension: "png" };
  const original = await fetch(sourceUrl);
  if (!original.ok) throw new Error("Não foi possível baixar uma das imagens.");
  const contentType = original.headers.get("content-type") ?? "";
  return { blob: await original.blob(), extension: contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "bin" };
}

type RazorColor = "pink" | "blue" | "yellow";
const razorColors: { name: string; className: RazorColor }[] = [{ name: "Rosa", className: "pink" }, { name: "Azul claro", className: "blue" }, { name: "Amarelo", className: "yellow" }];

function RazorShape({ color, view = "front", compact = false }: { color: RazorColor; view?: "front" | "side" | "back"; compact?: boolean }) {
  return <span className={`razor-object razor-${color} razor-view-${view} ${compact ? "compact" : ""}`} aria-label={`Navalha ${color}`}><i className="razor-blade" /><i className="razor-neck" /><i className="razor-handle" /></span>;
}

function RazorSet({ className = "" }: { className?: string }) {
  return <div className={`razor-set ${className}`}>{razorColors.map((color) => <div className="razor-unit" key={color.className}><RazorShape color={color.className} /><small>{color.name}</small></div>)}</div>;
}

function AssetCardHeader({ index, title, description, complete }: { index: string; title: string; description: string; complete: boolean }) {
  return <div className="asset-card-header"><span className="asset-card-number">{index}</span><div><strong>{title}</strong><small>{description}</small></div><span className={`complete-badge ${complete ? "" : "in-progress"}`}>{complete ? "+ Web ✓" : "Buscando..."}</span></div>;
}

function OptimizedDataTable({ analysis, isNavalha }: { analysis: ProductAnalysis; isNavalha: boolean }) {
  const rows = isNavalha ? [
    ["Produto principal", "Kit de navalhas para sobrancelhas"],
    ["Conteúdo do kit", "3 unidades · rosa, azul claro e amarelo"],
    ["Medidas por unidade", "14,5 cm × 3,5 cm"],
    ["Aplicação", "Acabamento e desenho de sobrancelhas"],
    ["NCM sugerido", analysis.fiscal.ncm],
    ["CEST", analysis.fiscal.cest],
    ["Unidade de venda", "Kit com 3 peças"],
    ["Dados logísticos", "Peso, GTIN e origem: confirmar na embalagem"],
  ] : [
    ["Produto identificado", analysis.identifiedAs],
    ...analysis.technicalSheet.slice(0, 4).map((item) => [item.label, item.value]),
    ["NCM sugerido", analysis.fiscal.ncm],
    ["CEST", analysis.fiscal.cest],
    ["Preço médio estimado", analysis.price.average ? money(analysis.price.average) : "A confirmar"],
  ];
  return <section className="optimized-data-card"><div className="optimized-data-heading"><div><span className="eyebrow">TABELA DE DADOS OTIMIZADOS</span><h4>Ficha pronta para revisar e publicar</h4></div><span className="complete-badge">Completo ✓</span></div><div className="optimized-data-table">{rows.map(([label, value]) => <div className="optimized-data-row" key={label}><span>{label}</span><strong>{value}</strong>{(label.includes("NCM") || label === "CEST") && <small>validar</small>}</div>)}</div><p className="optimized-note">Dados extraídos/simulados a partir da referência visual. Confirme as informações fiscais, logísticas e medidas na embalagem antes de publicar.</p></section>;
}

function SearchedAssetImage({ variant, alt, loading, error, className = "" }: { variant?: CommercialVariant; alt: string; loading: boolean; error: boolean; className?: string }) {
  return <div className={`searched-asset-image ${className}`}>
    {variant?.imageUrl ? <img src={variant.imageUrl} alt={alt} /> : <div className="searched-asset-empty">{loading ? <><span className="loading-spinner" /><small>Buscando na web...</small></> : <><span>—</span><small>{error ? "Sem resultado web" : "Aguardando resultado"}</small></>}</div>}
    {variant?.imageUrl && <div className="searched-asset-meta"><small>Resultado web</small>{variant.sourceUrl && <a href={variant.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}</div>}
  </div>;
}

function NavalhaAssetCard({ variant, index, complete, loading, error }: { variant?: CommercialVariant; index: number; complete: boolean; loading: boolean; error: boolean }) {
  const cardHeader = [
    ["01", "Medidas e ficha técnica", "3 unidades fora da embalagem"],
    ["02", "Lifestyle & uso prático", "Aplicação na sobrancelha"],
    ["03", "Galeria de ângulos multicor", "Frente, lado e trás"],
    ["04", "Cenário ambientado", "Bancada de banheiro"],
  ][index];
  if (index === 0) return <article className="special-asset-card"><AssetCardHeader index={cardHeader[0]} title={cardHeader[1]} description={cardHeader[2]} complete={complete} /><div className="technical-asset-visual"><SearchedAssetImage variant={variant} alt="Imagem web do kit de navalhas" loading={loading} error={error} /><RazorSet className="technical-razors" /><div className="measure-callouts"><span><b>14,5 cm</b><small>comprimento</small></span><span><b>3,5 cm</b><small>largura</small></span></div><div className="closeup-row">{[0, 1, 2].map((detailIndex) => <div className="closeup-circle" key={detailIndex}>{variant?.imageUrl ? <img src={variant.imageUrl} alt={`Close-up web ${detailIndex + 1}`} /> : loading ? <span className="loading-spinner" /> : <span>—</span>}<span>web</span></div>)}</div></div><div className="asset-card-footer"><span>Ficha técnica e medidas</span><b>3 cores identificadas</b></div></article>;
  if (index === 1) return <article className="special-asset-card"><AssetCardHeader index={cardHeader[0]} title={cardHeader[1]} description={cardHeader[2]} complete={complete} /><div className="lifestyle-asset-visual"><SearchedAssetImage variant={variant} alt="Imagem web de uso prático da navalha" loading={loading} error={error} /><span className="scene-chip">Uso real · web</span><div className="lifestyle-focus">precisão<br />no acabamento</div></div><RazorSet className="lifestyle-razors" /><div className="closeup-row compact-closeups">{[0, 1, 2].map((detailIndex) => <div className="closeup-circle" key={detailIndex}>{variant?.imageUrl ? <img src={variant.imageUrl} alt={`Detalhe web ${detailIndex + 1}`} /> : loading ? <span className="loading-spinner" /> : <span>—</span>}<span>web</span></div>)}</div></article>;
  if (index === 2) return <article className="special-asset-card"><AssetCardHeader index={cardHeader[0]} title={cardHeader[1]} description={cardHeader[2]} complete={complete} /><SearchedAssetImage variant={variant} alt="Imagem web das navalhas em estúdio" loading={loading} error={error} className="angle-search-image" /><div className="angle-grid">{razorColors.flatMap((color) => ["front", "side", "back"].map((view) => <div className="angle-cell" key={`${color.className}-${view}`}><RazorShape color={color.className} view={view as "front" | "side" | "back"} compact /><small>{color.name} · {view === "front" ? "frente" : view === "side" ? "lado" : "trás"}</small></div>))}</div></article>;
  return <article className="special-asset-card"><AssetCardHeader index={cardHeader[0]} title={cardHeader[1]} description={cardHeader[2]} complete={complete} /><div className="bathroom-asset-visual"><SearchedAssetImage variant={variant} alt="Imagem web das navalhas em banheiro" loading={loading} error={error} /><div className="bathroom-counter" /><div className="bathroom-razors"><RazorSet /></div><span className="scene-chip">Banheiro · web</span></div><div className="asset-card-footer"><span>Composição ambientada</span><b>Resultado encontrado</b></div></article>;
}

function CommercialAssets({ imageUrl, analysis, isGenerating, commercialVariants, commercialError, downloadFeedback, isDownloadingKit, onDownload, sourceOpen, visualSearching, visualSearchError, visualResults, onSearch }: { imageUrl: string; analysis: ProductAnalysis; isGenerating: boolean; commercialVariants: CommercialVariant[]; commercialError: string; downloadFeedback: string; isDownloadingKit: boolean; onDownload: () => Promise<void>; sourceOpen: boolean; visualSearching: boolean; visualSearchError: string; visualResults: { imageUrl: string; sourceUrl: string }[]; onSearch: () => void }) {
  const isNavalha = /navalha|sobrancelha/i.test(`${analysis.identifiedAs} ${analysis.title}`);
  const complete = !isGenerating && commercialVariants.length === 4;
  const generationMessage = commercialError || "";
  const progress = isGenerating ? "50%" : complete ? "100%" : "0%";
  return <section className="asset-intelligence-panel"><div className="asset-intelligence-heading"><div><span className="eyebrow">ATIVOS COMERCIAIS · BUSCA WEB</span><h3>Da entrada original ao kit de publicação</h3><p>{isNavalha ? "Produto principal identificado: kit de navalhas para sobrancelhas. Os cards recebem imagens comerciais encontradas para esse produto." : "A referência visual foi convertida em variações comerciais com imagens encontradas para o produto identificado."}</p></div><span className={`generated-status ${isGenerating ? "generating" : ""}`}>{isGenerating ? "● buscando na web" : complete ? "● completo ✓" : "● atenção"}</span></div><div className="asset-progress-row"><div><span>Identificação do produto</span><strong>100%</strong><div className="asset-progress-track"><i style={{ width: "100%" }} /></div></div><div><span>Imagens comerciais web</span><strong>{progress}</strong><div className="asset-progress-track"><i style={{ width: progress }} /></div></div><div><span>Dados otimizados</span><strong>100%</strong><div className="asset-progress-track"><i style={{ width: "100%" }} /></div></div></div><div className="asset-entry-layout"><article className="original-asset-card"><div className="asset-card-header"><span className="asset-card-number">00</span><div><strong>Entrada original</strong><small>Imagem recebida para análise</small></div><span className="complete-badge">Completo ✓</span></div><div className="original-asset-image"><img src={imageUrl} alt="Entrada original do produto" /><span>referência</span></div><div className="original-asset-caption"><span>Produto identificado</span><strong>{analysis.identifiedAs}</strong><small>Dados visuais e embalagem usados como referência.</small></div></article><div className="desired-grid-wrap"><div className="desired-grid-heading"><div><span className="eyebrow">GRADE DE 4 IMAGENS WEB · DESEJADAS</span><h4>Ativos fora da embalagem</h4></div><span className="mini-complete-badge">{isGenerating ? "buscando 4 imagens..." : complete ? "4/4 encontradas ✓" : `${commercialVariants.length}/4 encontradas`}</span></div><div className={`special-asset-grid ${isNavalha ? "navalha-grid" : ""}`}>{[0, 1, 2, 3].map((index) => isNavalha ? <NavalhaAssetCard key={index} index={index} variant={commercialVariants[index]} complete={complete} loading={isGenerating} error={Boolean(commercialError)} /> : <article className="special-asset-card generic-asset-card" key={index}><AssetCardHeader index={String(index + 1).padStart(2, "0")} title={commercialVariants[index]?.label ?? ["Ângulo alternativo", "Detalhe aproximado", "Lifestyle", "Cenário ambientado"][index]} description={commercialVariants[index]?.description ?? "Aguardando resultado web"} complete={complete} /><SearchedAssetImage variant={commercialVariants[index]} alt={commercialVariants[index]?.label ?? "Imagem comercial do produto"} loading={isGenerating} error={Boolean(commercialError)} /></article>)}</div></div></div><OptimizedDataTable analysis={analysis} isNavalha={isNavalha} />{generationMessage && <p className="reference-error">{generationMessage}</p>}<div className="asset-actions"><button className="download-images-button" onClick={() => void onDownload()} disabled={isGenerating || isDownloadingKit || commercialVariants.length < 4}>{downloadFeedback || (isDownloadingKit ? "Baixando kit..." : "Baixar Kit de Imagens")} <span>↓</span></button><button className="reference-button" onClick={onSearch} disabled={visualSearching}>⌕ {visualSearching ? "Pesquisando a foto original..." : "Encontrar fotos reais pela foto"}</button></div>{visualSearchError && <p className="reference-error">{visualSearchError}</p>}{sourceOpen && <div className="reference-panel"><strong>Fotos encontradas pela imagem original</strong><p>As correspondências abaixo vêm da busca visual. Confirme se pertencem ao mesmo produto antes de usar no anúncio.</p>{visualResults.length > 0 ? <div className="visual-results">{visualResults.map((result, index) => <article className="visual-result" key={`${result.imageUrl}-${index}`}><img src={result.imageUrl} alt={`Correspondência visual ${index + 1}`} /><a href={result.imageUrl} target="_blank" rel="noreferrer">Abrir imagem ↗</a></article>)}</div> : <div className="visual-empty">A busca foi aberta em uma nova aba. Selecione resultados da Shopee ou do site oficial por lá.</div>}</div>}</section>;
}

function MarketLabProcessingDashboard({ imageUrl, analysis, profilePhoto, onReplaceImage }: { imageUrl: string; analysis: ProductAnalysis; profilePhoto: string; onReplaceImage: () => void }) {
  const isNavalha = /navalha|sobrancelha/i.test(`${analysis.identifiedAs} ${analysis.title}`);
  const [variants, setVariants] = useState<CommercialVariant[]>([]);
  const [isSearching, setIsSearching] = useState(true);
  const [searchError, setSearchError] = useState("");
  const [feedback, setFeedback] = useState("");
  const productTitle = isNavalha ? "Kit de navalhas para sobrancelhas" : analysis.identifiedAs;
  const variationTitles = ["01 - Medidas & Ficha Técnica", "02 - Lifestyle & Uso Prático", "03 - Ângulos de Estúdio (Multicor)", "04 - Cenário Ambientado (Banheiro)"];
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => { if (!active) return; setVariants([]); setSearchError(""); setIsSearching(true); void searchProductImages(productTitle, analysis.ean ?? "").then((images) => { if (active) { setVariants(toCommercialVariants(images)); setIsSearching(false); } }).catch((error) => { if (active) { setVariants([]); setIsSearching(false); setSearchError(error instanceof Error ? error.message : "Não foi possível buscar imagens comerciais na web."); } }); }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [analysis.ean, analysis.identifiedAs, analysis.title, imageUrl, productTitle]);
  const listingDescription = `${analysis.description}\n\n${analysis.bullets.map((bullet) => `• ${bullet}`).join("\n")}`;
  async function copyText(value: string, label: string) {
    try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value); else { const textarea = document.createElement("textarea"); textarea.value = value; textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove(); } setFeedback(`${label} copiado`); } catch { setFeedback("Não foi possível copiar"); }
    window.setTimeout(() => setFeedback(""), 2400);
  }
  async function downloadKit() {
    if (variants.length < 4) return;
    setFeedback("Preparando kit...");
    try {
      for (const [index, variant] of variants.entries()) { const downloadable = await fetchDownloadableImage(variant.imageUrl); const objectUrl = URL.createObjectURL(downloadable.blob); const link = document.createElement("a"); link.href = objectUrl; link.download = `marketlab-${index + 1}.${downloadable.extension}`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); await new Promise<void>((resolve) => window.setTimeout(resolve, 180)); }
      setFeedback("Kit de imagens baixado");
    } catch { setFeedback("Não foi possível baixar o kit"); }
    window.setTimeout(() => setFeedback(""), 2600);
  }
  function downloadFiscalData() {
    const data = isNavalha ? { produto: productTitle, referencia: "RBC0345", quantidade: 3, caixaMaster: 720, ncm: analysis.fiscal.ncm, cest: analysis.fiscal.cest, ean: analysis.ean ?? "A confirmar", medidas: "14,5 cm × 3,5 cm" } : { produto: productTitle, ncm: analysis.fiscal.ncm, cest: analysis.fiscal.cest, precoMedio: analysis.price.average };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "marketlab-dados-fiscais.json"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setFeedback("Dados fiscais baixados"); window.setTimeout(() => setFeedback(""), 2400);
  }
  const originalRows = isNavalha ? [["Ref", "RBC0345"], ["Cx. Max", "720 unidades"], ["NCM", analysis.fiscal.ncm], ["CEST", analysis.fiscal.cest], ["EAN", analysis.ean ?? "A confirmar"]] : [["Ref", "A confirmar"], ["Cx. Max", "A confirmar"], ["NCM", analysis.fiscal.ncm], ["CEST", analysis.fiscal.cest], ["EAN", "A confirmar"]];
  const optimizedRows = isNavalha ? [["Ref", "RBC0345"], ["Qtde", "3 unidades"], ["Cx. Master", "720"], ["NCM", analysis.fiscal.ncm], ["CEST", analysis.fiscal.cest], ["EAN", analysis.ean ?? "A confirmar"]] : [["Ref", "A confirmar"], ["Qtde", "A confirmar"], ["Cx. Master", "A confirmar"], ["NCM", analysis.fiscal.ncm], ["CEST", analysis.fiscal.cest], ["EAN", "A confirmar"]];
  const searchPercent = isSearching ? "50%" : variants.length === 4 ? "100%" : "0%";
  const searchLabel = isSearching ? "Buscando imagens web" : variants.length === 4 ? "Completo" : "Configuração pendente";
  return (
    <main className="marketlab-processing-page">
      {analysis.analysisSource !== "vision" && <p className="analysis-source-note">{analysis.analysisNote ?? "A análise visual real está pendente de configuração."}</p>}
      <p className="reference-disclaimer">As imagens encontradas na web são referências visuais. Elas não confirmam automaticamente que pertencem ao mesmo produto nem que o uso comercial é autorizado.</p>
      <header className="processing-header"><div className="processing-brand"><span className="processing-brand-mark">⌁</span>MarketLab</div><div className="processing-avatar-wrap"><span>Conta ativa</span>{profilePhoto ? <img src={profilePhoto} alt="Avatar do usuário" className="processing-avatar" /> : <div className="processing-avatar">MS</div>}</div></header>
      <div className="processing-titlebar"><div><span className="processing-kicker">WORKSPACE / ATIVOS COMERCIAIS</span><h1>MarketLab - Processamento de Ativos</h1></div><div className="processing-actions"><div className="processing-completion"><div><span>Busca de imagens</span><strong>{searchPercent}</strong></div><div className="processing-progress"><i style={{ width: searchPercent }} /></div><b>{searchLabel}</b></div><button className="processing-navy-button" onClick={() => void downloadKit()} disabled={isSearching || variants.length < 4}>{feedback || "Baixar Kit de Imagens"}<span>↓</span></button></div></div>
      <div className="processing-columns">
        <section className="processing-column original-column"><div className="processing-column-heading"><div><span>01</span><div><small>COLUNA</small><h2>ENTRADA <b>(ORIGINAL)</b></h2></div></div><i /></div><article className="original-input-card"><div className="original-input-image"><img src={imageUrl} alt="Embalagem original do produto" /><span>+ Original</span><button onClick={onReplaceImage}>Trocar foto</button></div><h3>{productTitle}</h3><p className="original-subtitle">Produto identificado a partir da embalagem</p><table className="original-data-table"><tbody>{originalRows.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table></article></section>
        <section className="processing-column variations-column"><div className="processing-column-heading"><div><span>02</span><div><small>COLUNA</small><h2>VARIAÇÕES <b>(DESEJADAS)</b></h2></div></div><i /></div>{searchError && <p className="processing-search-error">{searchError}</p>}<div className="processing-variation-grid">{[0, 1, 2, 3].map((index) => isNavalha ? <NavalhaAssetCard key={index} index={index} variant={variants[index]} complete={!isSearching && variants.length === 4} loading={isSearching} error={Boolean(searchError)} /> : <article className="processing-variation-card" key={index}><SearchedAssetImage variant={variants[index]} alt={variationTitles[index]} loading={isSearching} error={Boolean(searchError)} /><strong>{variationTitles[index]}</strong></article>)}</div></section>
        <section className="processing-column data-column"><div className="processing-column-heading"><div><span>03</span><div><small>COLUNA</small><h2>DADOS DO PRODUTO</h2><b>(EXTRAÍDOS & OTIMIZADOS)</b></div></div><i /></div><article className="processing-data-card"><div className="processing-data-section"><span> TÍTULO (OTIMIZADO)</span><h3>{analysis.title}</h3></div><div className="processing-data-section"><span>DESCRIÇÃO (PERSUASIVA)</span><p>{analysis.description}</p><ul>{analysis.bullets.slice(0, 3).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></div><table className="optimized-table"><tbody>{optimizedRows.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table><div className="processing-outline-actions"><button onClick={() => void copyText(analysis.title, "Título")}>Copiar Título</button><button onClick={() => void copyText(listingDescription, "Descrição")}>Copiar Descrição</button><button onClick={downloadFiscalData}>Baixar Dados Fiscais</button></div><div className="processing-data-footer"><div><span>Dados otimizados</span><strong>Completo</strong></div><div className="processing-progress"><i /></div><button className="processing-navy-button" onClick={() => void downloadKit()} disabled={isSearching || variants.length < 4}>Baixar Kit de Imagens <span>↓</span></button><button className="processing-next-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Próximo Passo <span>→</span></button></div></article></section>
      </div>
    </main>
  );
}

function ProductResult({ imageUrl, analysis, platform }: { imageUrl: string; analysis: ProductAnalysis; platform: Platform }) {
  const publicSearch = platforms.find((p) => p.name === platform)?.url ?? "#";
  const [isGenerating, setIsGenerating] = useState(false);
  const [commercialVariants, setCommercialVariants] = useState<CommercialVariant[]>([]);
  const [commercialError, setCommercialError] = useState("");
  const [downloadFeedback, setDownloadFeedback] = useState("");
  const [isDownloadingKit, setIsDownloadingKit] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [visualSearching, setVisualSearching] = useState(false);
  const [visualSearchError, setVisualSearchError] = useState("");
  const [visualResults, setVisualResults] = useState<{ imageUrl: string; sourceUrl: string }[]>([]);
  const [copyFeedback, setCopyFeedback] = useState("");
  const sceneLabels = ["Ângulo alternativo", "Detalhe aproximado", "Lifestyle", "Cenário ambientado"];
  const listingText = `${analysis.title}\n\n${analysis.description}\n\n${analysis.bullets.map((bullet) => `• ${bullet}`).join("\n")}`;
  async function copyListing() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(listingText);
      else {
        const textarea = document.createElement("textarea"); textarea.value = listingText; textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove();
      }
      setCopyFeedback("Anúncio copiado!"); window.setTimeout(() => setCopyFeedback(""), 2200);
    } catch { setCopyFeedback("Não foi possível copiar"); window.setTimeout(() => setCopyFeedback(""), 2200); }
  }
  const generateCommercialImages = useCallback(async () => {
    setIsGenerating(true);
    setCommercialError("");
    try { setCommercialVariants(toCommercialVariants(await searchProductImages(analysis.identifiedAs, analysis.ean ?? ""))); }
    catch (error) { setCommercialVariants([]); setCommercialError(error instanceof Error ? error.message : "Não foi possível buscar imagens comerciais na web."); }
    finally { setIsGenerating(false); }
  }, [analysis.ean, analysis.identifiedAs]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void generateCommercialImages(); }, 0);
    return () => window.clearTimeout(timer);
  }, [generateCommercialImages]);
  async function downloadCommercialImages() {
    if (commercialVariants.length < 4 || isDownloadingKit) return;
    setIsDownloadingKit(true);
    setDownloadFeedback("");
    try {
      for (const [index, variant] of commercialVariants.entries()) {
        const downloadable = await fetchDownloadableImage(variant.imageUrl);
        const objectUrl = URL.createObjectURL(downloadable.blob);
        const link = document.createElement("a"); link.href = objectUrl; link.download = `tudo-do-ecommerce-${index + 1}-${variant.label.toLocaleLowerCase("pt-BR").replaceAll(" ", "-")}.${downloadable.extension}`; document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
      }
      setDownloadFeedback("Kit com 4 imagens enviado para download");
    } catch (error) {
      setDownloadFeedback(error instanceof Error ? error.message : "Não foi possível baixar o kit de imagens.");
    } finally {
      setIsDownloadingKit(false);
      window.setTimeout(() => setDownloadFeedback(""), 3000);
    }
  }
  async function searchByUploadedImage() {
    setVisualSearching(true); setVisualSearchError("");
    try { const image = await fetch(imageUrl).then((response) => response.blob()); const body = new FormData(); body.append("image", image, "produto.png"); const response = await fetch("/api/visual-search", { method: "POST", body }); const result = await response.json(); if (!response.ok || !result.url) throw new Error(result.error ?? "Não foi possível pesquisar a imagem."); setVisualResults(result.results ?? []); setSourceOpen(true); window.open(result.url, "_blank", "noopener,noreferrer"); } catch (error) { setVisualSearchError(error instanceof Error ? error.message : "Não foi possível pesquisar a imagem."); } finally { setVisualSearching(false); }
  }
  return <>
    {analysis.analysisSource !== "vision" && <p className="analysis-source-note">{analysis.analysisNote ?? "A análise visual real está pendente de configuração."}</p>}
    <p className="reference-disclaimer">As imagens encontradas na web são referências visuais. Elas não confirmam automaticamente que pertencem ao mesmo produto nem que o uso comercial é autorizado.</p>
    <CommercialAssets imageUrl={imageUrl} analysis={analysis} isGenerating={isGenerating} commercialVariants={commercialVariants} commercialError={commercialError} downloadFeedback={downloadFeedback} isDownloadingKit={isDownloadingKit} onDownload={() => downloadCommercialImages()} sourceOpen={sourceOpen} visualSearching={visualSearching} visualSearchError={visualSearchError} visualResults={visualResults} onSearch={() => void searchByUploadedImage()} />
    <div className="result-grid"><div className="product-preview"><div className="preview-badge">PRÉVIA DO ANÚNCIO</div><div className="preview-product"><img className="result-product-image" src={imageUrl} alt="Produto analisado" /><small>{analysis.identifiedAs}</small></div><button className="outline-button" onClick={() => void searchByUploadedImage()} disabled={visualSearching}>{visualSearching ? "Buscando pela foto..." : "Encontrar fotos reais"} <span>↗</span></button><button className="secondary-link" onClick={() => void generateCommercialImages()} disabled={isGenerating}>{isGenerating ? "Gerando imagens..." : "Regenerar imagens comerciais"}</button></div><div className="product-copy"><div className="copy-header"><div><span className="green-status">● análise concluída</span><h3>{analysis.title}</h3><small className="analysis-confidence">Identificação: {analysis.identifiedAs} · confiança {analysis.confidence}</small></div><button className="copy-button" onClick={copyListing}>⧉ {copyFeedback || "Copiar Anúncio"}</button></div><div className="copy-block"><span>TÍTULO OTIMIZADO</span><strong>{analysis.title}</strong></div><div className="copy-block"><span>DESCRIÇÃO PERSUASIVA</span><p>{analysis.description}</p><ul className="description-bullets">{analysis.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></div><div className="copy-block"><span>FICHA TÉCNICA</span><div className="technical-grid">{analysis.technicalSheet.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div><div className="copy-block"><span>DADOS FISCAIS SUGERIDOS</span><div className="fiscal-grid"><div><small>NCM sugerido</small><strong>{analysis.fiscal.ncm}</strong><p>{analysis.fiscal.ncmNote}</p></div><div><small>CEST sugerido</small><strong>{analysis.fiscal.cest}</strong><p>{analysis.fiscal.cestNote}</p></div></div></div><div className="data-strip"><div><span>Preço mínimo</span><strong>{analysis.price.minimum ? money(analysis.price.minimum) : "A confirmar"}</strong></div><div><span>Preço médio estimado</span><strong>{analysis.price.average ? money(analysis.price.average) : "A confirmar"}</strong></div><div><span>Preço máximo</span><strong>{analysis.price.maximum ? money(analysis.price.maximum) : "A confirmar"}</strong></div></div><div className="price-estimate-note">{analysis.price.note}</div><div className="result-footer"><span>{analysis.analysisSource === "vision" ? "Análise visual real concluída · revise antes de publicar" : analysis.analysisNote ?? "Fallback local · configure a visão real antes de publicar"}</span><a href={publicSearch + encodeURIComponent("produto")} target="_blank" rel="noreferrer">Abrir busca da loja ↗</a></div></div></div>
    <div className="generated-panel"><div className="generated-header"><div><span className="eyebrow">IMAGENS COMERCIAIS</span><h3>4 imagens encontradas na web</h3><p>Resultados buscados para o produto identificado e o EAN informado, sem placeholders locais.</p></div><span className={`generated-status ${isGenerating ? "generating" : ""}`}>{isGenerating ? "● buscando na web" : commercialVariants.length === 4 ? "● prontas" : "● aguardando"}</span></div><div className="generated-grid">{sceneLabels.map((label, index) => { const variant = commercialVariants[index]; return <div className="generated-card" key={label}><div className={`generated-image generated-image-${index}`}>{variant?.imageUrl ? <><img src={variant.imageUrl} alt={`${variant.label} do produto ${analysis.identifiedAs}`} /><span className="ai-generated-badge">↗ Resultado web</span></> : <div className="commercial-image-placeholder"><span className="loading-spinner" /><small>Buscando imagem {index + 1}</small></div>}</div><div className="generated-card-footer"><div><strong>{String(index + 1).padStart(2, "0")} · {variant?.label ?? label}</strong><small>{variant?.description ?? "Aguardando resultado web"}</small></div>{variant?.sourceUrl && <a href={variant.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}</div></div>; })}</div>{commercialError && <p className="reference-error">{commercialError}</p>}<button className="download-images-button" onClick={() => void downloadCommercialImages()} disabled={isGenerating || isDownloadingKit || commercialVariants.length < 4}>{downloadFeedback || (isDownloadingKit ? "Baixando kit..." : "Baixar Kit de Imagens")} <span>↓</span></button><button className="reference-button" onClick={() => void searchByUploadedImage()} disabled={visualSearching}>⌕ {visualSearching ? "Pesquisando a foto original..." : "Encontrar fotos reais pela foto"}</button>{visualSearchError && <p className="reference-error">{visualSearchError}</p>}{sourceOpen && <div className="reference-panel"><strong>Fotos encontradas pela imagem original</strong><p>As correspondências abaixo vêm da busca visual. Confirme se pertencem ao mesmo produto antes de usar no anúncio.</p>{visualResults.length > 0 ? <div className="visual-results">{visualResults.map((result, index) => <article className="visual-result" key={`${result.imageUrl}-${index}`}><img src={result.imageUrl} alt={`Correspondência visual ${index + 1}`} /><a href={result.imageUrl} target="_blank" rel="noreferrer">Abrir imagem ↗</a></article>)}</div> : <div className="visual-empty">A busca foi aberta em uma nova aba. Selecione resultados da Shopee ou do site oficial por lá.</div>}</div>}</div>
  </>;
}

type TrendItem = {
  rank: number;
  title: string;
  category: string;
  price: string;
  monthlySales: string;
  growth: string;
  imageUrl: string;
  url: string;
  origin: "google-trends" | "relatorio-publicado";
  sourceLabel: string;
  referenceDate: string;
  interestIndex?: number;
  direction?: "subindo" | "estável" | "caindo";
  reportPosition?: number;
};
type TrendSource = { origin: "google-trends" | "relatorio-publicado"; label: string; url: string; referenceDate: string };
type TrendFeed = { platform: Platform; mode: "live" | "cache" | "unavailable"; reason?: "missing-config" | "no-terms" | "provider-error" | "no-data"; items: TrendItem[]; checkedAt: string; sourceUrl: string; sourceLabel: string; sources: TrendSource[]; message: string; cachedAt?: string };

function trendAgeLabel(value?: string) {
  if (!value) return "aguardando primeira coleta";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (elapsedMinutes < 1) return "atualizado agora";
  if (elapsedMinutes < 60) return `atualizado há ${elapsedMinutes} min`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `atualizado há ${elapsedHours} h`;
  return `atualizado há ${Math.floor(elapsedHours / 24)} d`;
}

function TrendsView({ platform, current }: { platform: Platform; current: typeof marketplaceData[Platform] }) {
  const [feed, setFeed] = useState<TrendFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");

  const loadTrends = useCallback(async (force = false) => {
    setIsLoading(true);
    setFeed(null);
    setError("");
    setCategoryFilter("Todas");
    const startedAt = performance.now();
    try {
      const platformId = marketplaceIdFromName(platform);
      if (!platformId) throw new Error("Marketplace inválido para consulta de tendências.");
      const response = await fetch(`/api/trends?platform=${encodeURIComponent(platformId)}`, { method: force ? "POST" : "GET", cache: "no-store" });
      const result = await response.json() as TrendFeed & { error?: string };
      const remainingLoadingTime = Math.max(0, 650 - (performance.now() - startedAt));
      if (remainingLoadingTime > 0) await new Promise((resolve) => window.setTimeout(resolve, remainingLoadingTime));
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as tendências.");
      setFeed(result);
    } catch (loadError) {
      setFeed(null);
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as tendências.");
    } finally {
      setIsLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTrends(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTrends]);

  const items = feed?.items ?? [];
  const categories = ["Todas", ...Array.from(new Set(items.map((item) => item.category)))];
  const filteredItems = categoryFilter === "Todas" ? items : items.filter((item) => item.category === categoryFilter);

  const sourceStatus = feed?.mode === "unavailable"
    ? feed.reason === "missing-config" ? "configuração pendente" : feed.reason === "provider-error" ? "erro na fonte" : feed.reason === "no-terms" ? "termos não cadastrados" : "sem dados verificáveis"
    : feed?.mode === "cache" ? "última coleta em cache" : "fontes reais";
  const sourceHeading = feed?.mode === "unavailable"
    ? feed.reason === "missing-config" ? `Configuração pendente · ${platform}` : feed.reason === "provider-error" ? `Erro na fonte · ${platform}` : feed.reason === "no-terms" ? `Termos não cadastrados · ${platform}` : `Sem dados verificáveis · ${platform}`
    : `Fontes verificadas · ${platform}`;
  return <div className="trends-view"><div className="section-heading trends-heading"><div><div className="eyebrow">{current.eyebrow}</div><h2>Tendências verificadas no Brasil</h2><p>Interesse de busca e publicações periódicas por marketplace. Esta tela não representa um ranking de vendas ao vivo.</p></div><button className="period-chip refresh-trends" onClick={() => void loadTrends(true)} disabled={isLoading}>{isLoading ? "Sincronizando…" : "Forçar atualização ↻"}</button></div><div className="trend-toolbar"><label className="trend-filter-label">Categoria<select className="trend-filter-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} disabled={isLoading}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><span className="mock-data-badge">● {sourceStatus}</span><span className="trend-updated">{trendAgeLabel(feed?.checkedAt)} · coleta automática a cada 6 h</span></div><div className="trend-insight pending"><div className="trend-spark">↗</div><div><strong>{sourceHeading}</strong><p>{feed?.message ?? "Consultando o último snapshot salvo…"}</p></div><span>{items.length || "—"}<small>{items.length ? "itens encontrados" : "aguardando fonte"}</small></span></div>{isLoading ? <TrendSkeletonGrid /> : error ? <div className="trend-empty"><div className="trend-empty-icon">!</div><div><strong>Não foi possível carregar as tendências</strong><p>{error}</p><button className="source-secondary-action trend-empty-action" onClick={() => void loadTrends(true)}>Tentar novamente</button></div></div> : filteredItems.length === 0 ? <div className="trend-empty"><div className="trend-empty-icon">⌕</div><div><strong>Nenhum item verificável para {platform}</strong><p>{feed?.message ?? `Não há dados verificáveis para ${platform} neste momento.`}</p></div></div> : <div className="trend-ranking-grid">{filteredItems.map((trend) => { const isGoogleTrends = trend.origin === "google-trends"; const measure = isGoogleTrends ? `${trend.interestIndex ?? "—"}/100` : trend.reportPosition ? `posição ${trend.reportPosition}` : "publicado"; const measureLabel = isGoogleTrends ? "índice relativo de busca" : "referência no relatório"; return <article className="trend-ranking-card" key={`${trend.origin}-${trend.title}-${trend.rank}`}><div className="trend-ranking-image"><span className="ranking-position">#{trend.rank}</span>{trend.imageUrl ? <img src={trend.imageUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="trend-image-fallback" aria-label="A fonte não publicou imagem">↗</div>}<span className="growth-pill">{isGoogleTrends ? trend.direction : "Relatório"}</span></div><div className="trend-ranking-body"><span className="trend-category">{trend.category}</span><h3>{trend.title}</h3><div className="trend-price">{measure}<small>{measureLabel}</small></div><div className="trend-metrics"><span>Origem<strong>{isGoogleTrends ? "Google Trends" : "Relatório publicado"}</strong></span><span>Referência<strong>{trend.referenceDate}</strong></span></div><p className="trend-source-line">{trend.sourceLabel}</p><a href={trend.url} target="_blank" rel="noreferrer">{isGoogleTrends ? "Ver série no Google Trends ↗" : "Abrir publicação ↗"}</a></div></article>; })}</div>}<div className="trend-source-list">{feed?.sources?.map((source) => <a key={`${source.origin}-${source.url}`} href={source.url} target="_blank" rel="noreferrer">{source.label} · referência {source.referenceDate} ↗</a>)}</div><div className="data-disclaimer"><span>i</span>{feed?.checkedAt ? ` Snapshot consultado em ${new Date(feed.checkedAt).toLocaleString("pt-BR")}. ` : " "}Google Trends mede interesse relativo de busca, e relatórios representam o período publicado. Nenhum número de vendas ao vivo é inferido. <a href={feed?.sourceUrl ?? "#"} target="_blank" rel="noreferrer">Abrir fonte ↗</a></div></div>;
}

function TrendSkeletonGrid() {
  return <div className="trend-ranking-grid" aria-label="Carregando tendências"><div className="trend-skeleton-card"><div className="trend-skeleton-image" /><div className="trend-skeleton-body"><div className="trend-skeleton-line short" /><div className="trend-skeleton-line title" /><div className="trend-skeleton-line price" /><div className="trend-skeleton-metrics"><div /><div /></div></div></div><div className="trend-skeleton-card"><div className="trend-skeleton-image" /><div className="trend-skeleton-body"><div className="trend-skeleton-line short" /><div className="trend-skeleton-line title" /><div className="trend-skeleton-line price" /><div className="trend-skeleton-metrics"><div /><div /></div></div></div><div className="trend-skeleton-card"><div className="trend-skeleton-image" /><div className="trend-skeleton-body"><div className="trend-skeleton-line short" /><div className="trend-skeleton-line title" /><div className="trend-skeleton-line price" /><div className="trend-skeleton-metrics"><div /><div /></div></div></div><div className="trend-skeleton-card"><div className="trend-skeleton-image" /><div className="trend-skeleton-body"><div className="trend-skeleton-line short" /><div className="trend-skeleton-line title" /><div className="trend-skeleton-line price" /><div className="trend-skeleton-metrics"><div /><div /></div></div></div><div className="trend-skeleton-card"><div className="trend-skeleton-image" /><div className="trend-skeleton-body"><div className="trend-skeleton-line short" /><div className="trend-skeleton-line title" /><div className="trend-skeleton-line price" /><div className="trend-skeleton-metrics"><div /><div /></div></div></div><div className="trend-skeleton-card"><div className="trend-skeleton-image" /><div className="trend-skeleton-body"><div className="trend-skeleton-line short" /><div className="trend-skeleton-line title" /><div className="trend-skeleton-line price" /><div className="trend-skeleton-metrics"><div /><div /></div></div></div></div>;
}

function PricingView({ platform, cost, setCost, margin, setMargin, fee, setFee, fixed, setFixed, shipping, setShipping, recommendedPrice, net, profit, onSave }: { platform: Platform; cost: number; setCost: (v: number) => void; margin: number; setMargin: (v: number) => void; fee: number; setFee: (v: number) => void; fixed: number; setFixed: (v: number) => void; shipping: number; setShipping: (v: number) => void; recommendedPrice: number; net: number; profit: number; onSave: () => void }) {
  return <div className="pricing-view"><div className="section-heading trends-heading"><div><div className="eyebrow">SIMULADOR MULTICANAL</div><h2>Encontre o preço que faz sentido</h2><p>Altere os custos para simular o resultado de um anúncio na {platform}.</p></div><div className="platform-mini"><span>{platforms.find((p) => p.name === platform)?.mark}</span>{platform}</div></div><div className="pricing-layout"><div className="pricing-form"><div className="form-title"><span className="step-number">01</span><h3>Seus números</h3></div><Field label="Custo da mercadoria" prefix="R$" value={cost} onChange={setCost} /><Field label="Margem pretendida" suffix="%" value={margin} onChange={setMargin} /><div className="divider" /><div className="form-title"><span className="step-number muted">02</span><h3>Custos da plataforma</h3></div><Field label={`Comissão da ${platform}`} suffix="%" value={fee} onChange={setFee} /><Field label="Taxa fixa por venda" prefix="R$" value={fixed} onChange={setFixed} /><Field label="Frete / subsídio" prefix="R$" value={shipping} onChange={setShipping} /><p className="source-note">Referência inicial para {platform}. Confira as condições do seu anúncio, campanha, logística e programa de afiliados antes de publicar.</p></div><div className="pricing-result"><div className="result-label">PREÇO RECOMENDADO</div><div className="big-price">{money(recommendedPrice)}</div><div className="price-caption">para alcançar {margin}% de margem líquida estimada</div><div className="metric-row"><div><span>Você recebe</span><strong>{money(net)}</strong></div><div><span>Lucro por venda</span><strong className="green-text">{money(profit)}</strong></div></div><div className="bar-label"><span>Distribuição do preço</span><span>100%</span></div><div className="stacked-bar"><i style={{ width: `${Math.max(5, (cost / recommendedPrice) * 100)}%` }} /><i style={{ width: `${Math.max(4, fee)}%` }} /><i style={{ width: `${Math.max(3, ((fixed + shipping) / recommendedPrice) * 100)}%` }} /><i style={{ width: `${Math.max(8, (profit / recommendedPrice) * 100)}%` }} /></div><div className="legend"><span><i className="dot purple" />Mercadoria {Math.round((cost / recommendedPrice) * 100)}%</span><span><i className="dot orange" />Plataforma {fee}%</span><span><i className="dot yellow" />Taxas fixas</span><span><i className="dot green" />Margem</span></div><button className="primary-button full" onClick={onSave}>Salvar simulação no histórico <span>→</span></button><div className="price-footnote">⌁ Simulação estimada. Descontos, impostos e campanhas podem alterar o valor final.</div></div></div></div>;
}

function Field({ label, prefix, suffix, value, onChange }: { label: string; prefix?: string; suffix?: string; value: number; onChange: (value: number) => void }) {
  return <label className="field"><span>{label}</span><div>{prefix && <small>{prefix}</small>}<input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))} />{suffix && <small>{suffix}</small>}</div></label>;
}
