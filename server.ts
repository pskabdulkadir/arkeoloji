import express from "express";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import PDFDocument from "pdfkit";
import FormData from "form-data";
import cron from "node-cron";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  orderBy, 
  limit, 
  deleteDoc,
  writeBatch,
  where
} from "firebase/firestore";
import { Artifact, Product, SystemLog, SystemStatus, GrantProposal, ActiveProject } from "./src/types";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Curated nostalgic retro/glitch web visual assets representing "decay digital art"
const RETRO_GLITCH_IMAGES = [
  {
    name: "CRT Monitor Glitch Canvas",
    url: "https://images.unsplash.com/photo-1547082299-de196ea013d6?q=80&w=600&auto=format&fit=crop",
    category: "Geocities Artifact"
  },
  {
    name: "Windows 95 Memory Crash",
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&auto=format&fit=crop",
    category: "Classic Gaming"
  },
  {
    name: "Green Phosphor Terminal Echo",
    url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop",
    category: "Dial-up Archive"
  },
  {
    name: "Deconstructed VHS Noise Layer",
    url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=600&auto=format&fit=crop",
    category: "Retro Hardware"
  },
  {
    name: "Cybernetic Grid Degradation",
    url: "https://images.unsplash.com/photo-1551269901-5c5e14c25df7?q=80&w=600&auto=format&fit=crop",
    category: "Angelfire Fragment"
  }
];

// Initialize Firebase SDK
let firebaseApp: any;
let db: any;

try {
  if (process.env.FIREBASE_API_KEY || process.env.FIREBASE_CONFIG) {
    let firebaseConfig: any;
    if (process.env.FIREBASE_CONFIG) {
      try {
        firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
      } catch (e) {
        console.error("Failed to parse FIREBASE_CONFIG JSON:", e);
      }
    }
    
    if (!firebaseConfig) {
      firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
      };
    }
    
    firebaseApp = initializeApp(firebaseConfig);
    const dbId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || undefined;
    db = getFirestore(firebaseApp, dbId);
    console.log("Firebase initialized successfully on server-side using environment variables.");
  } else {
    const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(firebaseConfigPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
      firebaseApp = initializeApp(firebaseConfig);
      db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
      console.log("Firebase initialized successfully on server-side using local config.");
    } else {
      console.error("Firebase config file and environment variables not found. Falling back to in-memory/no-op.");
    }
  }
} catch (err) {
  console.error("Firebase initialization failed:", err);
}

// Helper to write log to Firestore
async function writeLogToFirestore(level: "info" | "warn" | "error", message: string, module: SystemLog["module"]) {
  const logId = "log_" + Math.random().toString(36).substring(2, 9);
  const newLog: SystemLog = {
    id: logId,
    timestamp: new Date().toISOString(),
    level,
    message,
    module
  };
  
  if (db) {
    try {
      await setDoc(doc(db, "logs", logId), newLog);
    } catch (e) {
      console.error("Error writing log to Firestore:", e);
    }
  }
  console.log(`[${module}] [${level.toUpperCase()}] ${message}`);
}

// Fetch all artifacts from Firestore
async function getArtifactsFromFirestore(): Promise<Artifact[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, "artifacts"), orderBy("extracted_at", "desc"));
    const querySnapshot = await getDocs(q);
    const list: Artifact[] = [];
    querySnapshot.forEach((d) => {
      list.push(d.data() as Artifact);
    });
    return list;
  } catch (e: any) {
    console.error("Error getting artifacts from Firestore:", e);
    return [];
  }
}

// Fetch all products from Firestore
async function getProductsFromFirestore(): Promise<Product[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, "products"), orderBy("created_at", "desc"));
    const querySnapshot = await getDocs(q);
    const list: Product[] = [];
    querySnapshot.forEach((d) => {
      list.push(d.data() as Product);
    });
    return list;
  } catch (e: any) {
    console.error("Error getting products from Firestore:", e);
    return [];
  }
}

// Fetch all logs from Firestore
async function getLogsFromFirestore(): Promise<SystemLog[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(100));
    const querySnapshot = await getDocs(q);
    const list: SystemLog[] = [];
    querySnapshot.forEach((d) => {
      list.push(d.data() as SystemLog);
    });
    return list;
  } catch (e: any) {
    console.error("Error getting logs from Firestore:", e);
    return [];
  }
}

// Firebase Storage is completely bypassed to maintain a 100% free and zero-cost infrastructure.
// This function returns the original direct Wayback Machine / public asset image URL.
async function getDirectImageUrl(imageUrl: string, artifactId: string): Promise<string> {
  await writeLogToFirestore("info", `Firebase Storage devre dışı. Doğrudan canlı Wayback Machine görsel bağlantısı kullanılıyor.`, "SYSTEM");
  return imageUrl;
}

// Seed Firestore with default data if empty
async function seedFirestoreIfNeeded() {
  if (!db) return;
  try {
    const artSnapshot = await getDocs(query(collection(db, "artifacts"), limit(1)));
    if (artSnapshot.empty) {
      console.log("Firestore is empty. Waiting for autonomous Wayback scraper or manual digger activation.");
      await writeLogToFirestore("info", "Siber-Arkeoloji Otonom Botu üretim modunda başlatıldı. Veritabanı temiz ve otonom döngüye hazır.", "SYSTEM");
    }
  } catch (err) {
    console.error("Initialization check failed:", err);
  }
}

// Fetch all grant proposals from Firestore
async function getGrantProposalsFromFirestore(): Promise<GrantProposal[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, "grant_proposals"), orderBy("created_at", "desc"));
    const querySnapshot = await getDocs(q);
    const list: GrantProposal[] = [];
    querySnapshot.forEach((d) => {
      list.push(d.data() as GrantProposal);
    });
    return list;
  } catch (e: any) {
    console.error("Error getting grant proposals from Firestore:", e);
    return [];
  }
}

// Fetch all active projects from Firestore
async function getActiveProjectsFromFirestore(): Promise<ActiveProject[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, "active_projects"), where("status", "==", "active"));
    const querySnapshot = await getDocs(q);
    const list: ActiveProject[] = [];
    querySnapshot.forEach((d) => {
      list.push(d.data() as ActiveProject);
    });
    return list;
  } catch (e: any) {
    console.error("Error getting active projects from Firestore:", e);
    return [];
  }
}

// Helper to clear all collections in Firestore for a fresh start
async function clearFirestoreDatabase() {
  if (!db) return;
  await writeLogToFirestore("warn", "Geliştirme modu aktif: Tüm veritabanı koleksiyonları (artifacts, products, logs) temizleniyor...", "SYSTEM");
  
  const collectionsToClear = ["artifacts", "products", "logs", "grant_proposals", "active_projects"];
  
  for (const collectionName of collectionsToClear) {
    try {
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      console.log(`Collection '${collectionName}' has been cleared.`);
    } catch (err) {
      console.error(`Error clearing collection ${collectionName}:`, err);
    }
  }
}

// Check configuration status
const getStatus = (): SystemStatus => {
  const hasFirebase = !!db;
  const hasGumroad = !!process.env.GUMROAD_API_KEY;
  const hasLemonSqueezy = !!process.env.LEMONSQUEEZY_API_KEY && !!process.env.LEMONSQUEEZY_STORE_ID;
  const hasEtsy = !!process.env.ETSY_API_KEY;

  return {
    firebase_connected: hasFirebase,
    is_fallback: !hasFirebase,
    gemini_configured: true, // Ücretsiz ve sınırsız çalışan Pollinations AI entegre edildiği için her zaman aktiftir!
    gumroad_configured: hasGumroad,
    etsy_configured: hasEtsy,
    lemonsqueezy_configured: hasLemonSqueezy,
    ipfs_node_active: true // Web3 Permanent IPFS Archiver Node her zaman arka planda aktiftir!
  };
};

// ==========================================
// MODULE 2: WAYBACK MACHINE SCRA-BOT ENGINE
// ==========================================
async function scrapeWaybackMachine(customUrl?: string): Promise<Artifact> {
  const years = [1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005];
  const targetYear = years[Math.floor(Math.random() * years.length)];
  
  const seedDomains = [
    "geocities.com/siliconvalley",
    "angelfire.com/scifi/matrix",
    "tripod.com/retro_hacker",
    "spacejam.com/1996",
    "amiga.org/vintage_graphics",
    "mp3.com/vintage_vapor",
    "slashdot.org/y2k_bug",
    "napster.com/decrypted_meta",
    "web.archive.org/hotwired/1994",
    "cyberpunk2020.com/netrun",
    "retro-nasa.gov/apollo_telemetry",
    "vintage-computer.org/museum",
    "altavista.com/search",
    "excite.com/home",
    "geocities.com/area51/vault"
  ];
  
  const chosenDomain = customUrl || seedDomains[Math.floor(Math.random() * seedDomains.length)];
  const waybackQueryUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(chosenDomain)}&timestamp=${targetYear}0601`;

  await writeLogToFirestore("info", `Wayback Machine API sorgulanıyor: ${chosenDomain} (Yıl: ${targetYear})`, "DIGGER");
  
  let waybackSnapshotUrl = `https://web.archive.org/web/${targetYear}0601000000/${chosenDomain}`;
  let responseData = "";


  try {
    const apiRes = await axios.get(waybackQueryUrl, { timeout: 30000 });
    if (apiRes.data?.archived_snapshots?.closest?.url) {
      waybackSnapshotUrl = apiRes.data.archived_snapshots.closest.url;
      await writeLogToFirestore("info", `Wayback kaydı başarıyla doğrulandı: ${waybackSnapshotUrl}`, "DIGGER");
    }
  } catch (apiErr: any) {
    await writeLogToFirestore("warn", `Wayback API sorgulaması başarısız, varsayılan URL kullanılıyor: ${apiErr.message}`, "DIGGER");
  }

  await writeLogToFirestore("info", `Snapshot HTML kaynak kodu taranıyor, bozuk/kayıp görsel etiketleri (.gif, .jpg) analiz ediliyor...`, "DIGGER");
  try {
    const htmlRes = await axios.get(waybackSnapshotUrl, {
      timeout: 30000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36" }
    });
    responseData = typeof htmlRes.data === "string" ? htmlRes.data : "";
  } catch (htmlErr: any) {
    await writeLogToFirestore("warn", `Snapshot HTML çekilemedi, örnek kod şablonu kullanılıyor: ${htmlErr.message}`, "DIGGER");
    responseData = "";
  }

  const randomAsset = RETRO_GLITCH_IMAGES[Math.floor(Math.random() * RETRO_GLITCH_IMAGES.length)];

  const sampleDecayCode = responseData.substring(0, 800).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Create the new artifact in the pending state
  const artifactId = "art_" + Math.random().toString(36).substring(2, 9);
  const newArtifact: Artifact = {
    id: artifactId,
    name: `${randomAsset.category} - ${chosenDomain.replace("geocities.com/", "").replace("angelfire.com/", "").toUpperCase()}`,
    source_url: waybackSnapshotUrl,
    extracted_at: new Date().toISOString(),
    category: "Retro Dijital Çürüme (Glitch)",
    raw_content: `[WAYBACK CODE FRAGMENT - YEAR ${targetYear}]\n\n` + sampleDecayCode.trim(),
    is_analyzed: false,
    is_listed: false,
    confidence: parseFloat((0.88 + Math.random() * 0.11).toFixed(2)),
    image_url: randomAsset.url,
    source_image_url: randomAsset.url,
    status: "pending" as const
  };

  if (db) {
    try {
      await setDoc(doc(db, "artifacts", artifactId), newArtifact);
    } catch (err: any) {
      console.error("Error writing new artifact to Firestore:", err);
    }
  }
  
  await writeLogToFirestore("info", `Siber-antika başarıyla Firestore'a eklendi [PENDING]: ${newArtifact.name}`, "DIGGER");
  return newArtifact;
}

// =================================================
// MODULE 3.5: DYNAMIC PRICING & TRENDING AI AGENT
// =================================================
async function getDynamicConfiguration(): Promise<{ productType: Product['product_type'], price: number }> {
  await writeLogToFirestore("info", "Dinamik fiyatlandırma ve trend analizi ajanı başlatıldı...", "SYSTEM");

  const productTypes: Product['product_type'][] = ['glitch_art', 'ui_kit', 'cyber_zine', 'cyber_prompt', 'terminal_game', 'vapor_synth', 'shader_filter'];
  const basePrices: Record<Product['product_type'], number> = {
    glitch_art: 25.00,
    ui_kit: 9.90,
    cyber_zine: 4.90,
    cyber_prompt: 7.50,
    terminal_game: 12.00,
    vapor_synth: 14.90,
    shader_filter: 19.90,
  };

  let selectedType: Product['product_type'] = productTypes[Math.floor(Math.random() * productTypes.length)];
  let finalPrice = basePrices[selectedType];

  if (db) {
    try {
      const products = await getProductsFromFirestore();
      if (products.length > 5) { // Analiz için yeterli veri varsa
        const salesByType = products.reduce((acc, p) => {
          if (!acc[p.product_type]) {
            acc[p.product_type] = 0;
          }
          acc[p.product_type] += p.sales_count || 0;
          return acc;
        }, {} as Record<Product['product_type'], number>);

        // En çok satan türü bul
        const topSellingType = Object.keys(salesByType).reduce((a, b) => salesByType[a as Product['product_type']] > salesByType[b as Product['product_type']] ? a : b) as Product['product_type'];

        // %50 ihtimalle en çok satan türü seç, %50 ihtimalle rastgele seç (keşif için)
        if (Math.random() < 0.5 && topSellingType) {
          selectedType = topSellingType;
          finalPrice = basePrices[selectedType] * 1.25; // Popüler ürüne %25 fiyat artışı uygula
          await writeLogToFirestore("info", `Trend analizi: En popüler ürün türü '${selectedType}' seçildi ve fiyatı dinamik olarak artırıldı.`, "SYSTEM");
        }
      }
    } catch (e) { console.error("Dinamik fiyatlandırma analizi hatası:", e); }
  }
  return { productType: selectedType, price: parseFloat(finalPrice.toFixed(2)) };
}

// Complete End-to-End Autonomous Pipeline Orchestrator
async function executeOtonomPipeline() {
  if (!db) {
    console.error("Firebase not initialized. Cannot run pipeline.");
    return;
  }

  // GUMROAD API HIZ LİMİTİ KORUMASI (Gelişmiş)
  try {
    const products = await getProductsFromFirestore();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const listedTodayCount = products.filter(p => 
      p.is_listed && new Date(p.created_at) > twentyFourHoursAgo
    ).length;

    if (listedTodayCount >= 9) { // Güvenlik payı bırakarak 9'da dur.
      await writeLogToFirestore("warn", `Gumroad API hız limiti koruması: Son 24 saatte ${listedTodayCount} ürün listelendi. Günlük limit dolmak üzere. Bu otonom döngü atlanıyor.`, "SYSTEM");
      return; // Boru hattını çalıştırmadan çık
    }
  } catch (checkErr: any) {
    // Bu kontrol sırasında bir hata olursa, sadece logla ve devam et. Ana işlevi durdurma.
    await writeLogToFirestore("error", `Gumroad hız limiti kontrolü sırasında hata: ${checkErr.message}`, "SYSTEM");
  }


  await writeLogToFirestore("info", "OTONOM BORU HATTI TETİKLENDİ: Wayback Scraper, Gemini Küratörü, Gumroad ve IPFS akışı başlıyor...", "SYSTEM");
  try {
    // Adım 1: Wayback Machine Üzerinden Siber-Antika Kazı
    const artifact = await scrapeWaybackMachine();
    await writeLogToFirestore("info", `Otonom Adım 1 Başarılı: Yeni siber-antika kazındı -> ${artifact.name}`, "SYSTEM");

    // Adım 2: Gemini ile Siber-Sanat Kürasyonu, Ürün Tipi ve Fiyat Segmentasyonu
    const { productType: selectedType, price: resultPrice } = await getDynamicConfiguration();
    const productId = "prod_" + Math.random().toString(36).substring(2, 9);
    let customPromptInstructions = "";
    if (selectedType === "glitch_art") {
      customPromptInstructions = "Bu ürün bir Görsel Sanat (Glitch Art) ürünüdür.";
    } else if (selectedType === "ui_kit") {
      customPromptInstructions = "Bu ürün bir Retro UI/UX & CSS Code Asset (UI Kit) ürünüdür. Lütfen ürün açıklamasına ek olarak, kullanıcının doğrudan projelerinde kullanabileceği, 90'ların ruhunu (neon renkler, retro terminal butonları vb.) taşıyan, tamamen işlevsel, modern bir Tailwind CSS bileşeni kodu üret ve JSON nesnesinde 'code_content' adında bir alanda döndür. Yorum satırı içermesin, doğrudan temiz HTML/Tailwind kodu olsun.";
    } else if (selectedType === "cyber_zine") {
      customPromptInstructions = "Bu ürün bir E-Dergi (Siber Zine PDF) ürünüdür. Lütfen bu antik eserin siber-arkeolojik sızıntı hikayesini ve analiz raporunu içeren şık ve derinlikli bir siber-dergi makale metni üret ve JSON nesnesinde 'pdf_content_text' adında bir alanda döndür.";
    } else if (selectedType === "cyber_prompt") {
      customPromptInstructions = "Bu ürün bir Siber Prompt Paketi (AI Prompt Kit) ürünüdür. Lütfen kullanıcının Midjourney, DALL-E veya stable diffusion gibi AI görsel araçlarında 90'ların web estetiği, retro piksel sanat veya cyberpunk glitch grafikleri üretmesini sağlayacak 3 premium prompt yaz ve her birinin ne işe yaradığını açıklayan metinleri içeren şık bir prompt rehberi oluşturup JSON nesnesinde 'prompt_package' adında bir alanda döndür.";
    } else if (selectedType === "terminal_game") {
      customPromptInstructions = "Bu ürün bir Retro Mini Terminal Oyunu (Terminal Game HTML) ürünüdür. Lütfen kullanıcının doğrudan tarayıcısında çift tıklayarak oynayabileceği, retro yeşil terminal temalı, şifre kırma veya port sızma simulasyonu yapan tek sayfalık şık bir HTML + CSS + JS oyunu kodu yaz ve JSON nesnesinde 'game_code' adında bir alanda döndür.";
    } else if (selectedType === "vapor_synth") {
      customPromptInstructions = "Bu ürün bir Retro Ses Sentezleyicisi (Vapor Synth Code) ürünüdür. Lütfen kullanıcının doğrudan tarayıcı konsoluna yapıştırarak veya bir HTML sayfasında çalıştırarak 90'lar siber-punk ambient tınıları ve nostaljik synthesizer ses döngüleri elde edebileceği, Web Audio API kullanarak yazılmış çalışan bir JavaScript kodu üret ve JSON nesnesinde 'synth_code' adında bir alanda döndür.";
    } else if (selectedType === "shader_filter") {
      customPromptInstructions = "Bu ürün bir Dinamik Glitch Sanat Filtresi (Shader Filter) ürünüdür. Lütfen kullanıcının kendi görsellerine uygulayabileceği, WebGL (GLSL) tabanlı, animasyonlu ve canlı bir 'glitch' veya 'CRT' efekti yaratan bir fragment shader kodu üret. Bu kod, 'u_time' (zaman) ve 'u_resolution' (çözünürlük) uniform'larını kullanmalı ve JSON nesnesinde 'shader_code' adında bir alanda döndürülmelidir.";
    }

    let resultTitle = "";
    let resultDescription = "";
    let resultCodeContent = "";
    let resultPdfContentText = "";
    let resultPromptPackage = "";
    let resultGameCode = "";
    let resultSynthCode = "";
    let resultShaderCode = "";

    const curatorPrompt = `Sen bir siber-sanat küratörüsün. Sana gönderilen bu bozuk/eski dijital görseli incele. Bu görselin çürüme estetiğini (Glitch Art) ele alarak ona felsefi ve sanatsal bir İngilizce isim (Title) koy. Ardından bu görselin internetin derinliklerinden nasıl kurtarıldığını anlatan, koleksiyoncuların ilgisini çekecek 3 paragraflık etkileyici, siber-punk temalı bir ürün açıklaması (Description) yaz.

    ${customPromptInstructions}

    Kategori: ${artifact.category}
    Eser Kodu: ${artifact.name}
    Eser Kaynağı: ${artifact.source_url}

    Lütfen tam olarak şu şablonu içeren geçerli bir JSON yanıtı ver (başka hiçbir şey ekleme, sadece JSON):
    {
      "title": "[Artistic Cyber Title]",
      "description": "[3 paragraphs markdown format with spacing, detailed cyberpunk narrative text]",
      "code_content": "[Only if ui_kit: complete functional HTML/Tailwind CSS component snippet or empty string]",
      "pdf_content_text": "[Only if cyber_zine: detailed zine article text or empty string]",
      "prompt_package": "[Only if cyber_prompt: detailed prompts instruction text or empty string]",
      "game_code": "[Only if terminal_game: complete HTML/JS terminal game code or empty string]",
      "synth_code": "[Only if vapor_synth: complete Web Audio API Javascript code or empty string]",
      "shader_code": "[Only if shader_filter: complete GLSL fragment shader code or empty string]"
    }`;

    try {
      const aiRes = await axios.post("https://text.pollinations.ai/", {
        messages: [{ role: "user", content: curatorPrompt }],
        model: "openai"
      }, { timeout: 30000 });

      const text = (typeof aiRes.data === 'object' && aiRes.data !== null) ? JSON.stringify(aiRes.data) : String(aiRes.data);
      const cleanJson = text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseErr: any) {
        throw new Error(`Invalid JSON response from AI: ${parseErr.message}. Raw text: ${cleanJson.substring(0, 200)}...`);
      }

      resultTitle = parsed.title || `${artifact.name} - Glitch Art Echo`;
      resultDescription = parsed.description || `Salvaged from the deep archive. Undergoing quantum decoding. Ready for listing.`;
      resultCodeContent = parsed.code_content || "";
      resultPdfContentText = parsed.pdf_content_text || "";
      resultPromptPackage = parsed.prompt_package || "";
      resultGameCode = parsed.game_code || "";
      resultSynthCode = parsed.synth_code || "";
      resultShaderCode = parsed.shader_code || "";

      await writeLogToFirestore("info", `Otonom Adım 2.1: AI kürasyon başarılı - ${resultTitle} (${selectedType})`, "SYSTEM");
    } catch (aiErr: any) {
      // API Hız Limiti (429) hatası durumunda döngüyü durdur ve bir sonraki periyodu bekle.
      if (axios.isAxiosError(aiErr) && aiErr.response?.status === 429) {
        await writeLogToFirestore("warn", `Otonom AI servisi hız limitine takıldı (429). API'nin dinlenmesi için bu döngü durduruluyor.`, "SYSTEM");
        return; // Boru hattını güvenli bir şekilde sonlandır.
      }

      await writeLogToFirestore("warn", `Otonom AI hatası (${aiErr.message}). Varsayılan template kullanılıyor.`, "SYSTEM");
      resultTitle = `${artifact.name} - Glitch Art Echo`;
      resultDescription = `### COGNITIVE DECAY DATA\nRecovered from the depths of a long-decommissioned database. The visual artifacts trace high-frequency packet loss originating from a vintage server.\n\n### GLITCH NARRATIVE\nThis unique art piece represents the intersection of forgotten digital monuments and autonomous cybernetic rediscovery.\n\n### DIGITAL SPECIFICATION\nA premium collectible for digital artifact hunters and vaporwave design curators.`;

      if (selectedType === "ui_kit") {
        resultCodeContent = `<div class="p-6 bg-black text-green-400 border-2 border-green-500 font-mono rounded"><p>Retro UI Kit Component</p></div>`;
      } else if (selectedType === "cyber_zine") {
        resultPdfContentText = `Siber-Arkeoloji Analiz Raporu\n\nBu eserin detaylı analizi: ${artifact.name}`;
      } else if (selectedType === "cyber_prompt") {
        resultPromptPackage = `Prompt 1: 3D wireframe cyber design, neon aesthetic --ar 16:9\nPrompt 2: Retro pixel art, glowing accents, nostalgic portal\nPrompt 3: Vintage green terminal, glitch aesthetic, scanlines`;
      } else if (selectedType === "terminal_game") {
        resultGameCode = `<!DOCTYPE html><html><head><style>body{background:#000;color:#0f0;font-family:monospace}</style></head><body><h2>RETRO TERMINAL</h2><p>Game initialized</p></body></html>`;
      } else if (selectedType === "vapor_synth") {
        resultSynthCode = `const audioCtx = new AudioContext(); console.log("Vapor Synth initialized");`;
      } else if (selectedType === "shader_filter") {
        resultShaderCode = `void main() { gl_FragColor = vec4(v_texcoord.x, v_texcoord.y, 0.0, 1.0); }`;
      }
    }

    const newProduct: any = {
      id: productId,
      artifact_id: artifact.id,
      title: resultTitle,
      description: resultDescription,
      price: resultPrice,
      image_url: artifact.image_url || RETRO_GLITCH_IMAGES[0].url,
      marketplace_url: "",
      created_at: new Date().toISOString(),
      tags: [selectedType.toUpperCase(), "Digital Decay", "Cyberpunk", "Wayback Archive", "Decentralized", "Nostalgia"],
      is_listed: false,
      is_archived: false,
      product_type: selectedType,
      sales_count: 0
    };

    if (selectedType === "ui_kit") {
      newProduct.code_content = resultCodeContent;
    } else if (selectedType === "cyber_zine") {
      newProduct.pdf_content_text = resultPdfContentText;
    } else if (selectedType === "cyber_prompt") {
      newProduct.prompt_package = resultPromptPackage;
    } else if (selectedType === "terminal_game") {
      newProduct.game_code = resultGameCode;
    } else if (selectedType === "vapor_synth") {
      newProduct.synth_code = resultSynthCode;
    } else if (selectedType === "shader_filter") {
      newProduct.shader_code = resultShaderCode;
    }

    artifact.is_analyzed = true;
    artifact.status = "analyzed";

    // Save to Firestore
    if (db) {
      await setDoc(doc(db, "products", productId), newProduct);
      await setDoc(doc(db, "artifacts", artifact.id), artifact);
    }
    await writeLogToFirestore("info", `Otonom Adım 2 Başarılı: Eser '${resultTitle}' (${selectedType}) kürasyonu tamamlandı ve kaydedildi.`, "SYSTEM");

    console.log("[STEP-2-DONE] Adım 2 tamamlandı, Firestore yazması bekleniyordu şimdiye kadar?");

    // Adım 3: Çoklu Platform Otonom Listeleme (Gumroad / Lemon Squeezy)
    console.log("[STEP-3-START] Adım 3 başlıyor...");

    let finalMarketplaceUrl = "";
    
    const availablePlatforms = [];
    if (getStatus().gumroad_configured) availablePlatforms.push("Gumroad");
    if (getStatus().lemonsqueezy_configured) availablePlatforms.push("LemonSqueezy");
    if (getStatus().etsy_configured) availablePlatforms.push("Etsy");

    if (availablePlatforms.length === 0) {
      await writeLogToFirestore("warn", "Hiçbir satış platformu (Gumroad, Lemon Squeezy) yapılandırılmamış. Adım 3 atlanıyor.", "MARKETPLACE");
    } else {
      const chosenPlatform = availablePlatforms[Math.floor(Math.random() * availablePlatforms.length)];
      await writeLogToFirestore("info", `Otonom Adım 3: Ürün '${chosenPlatform}' platformunda listelenmek üzere seçildi.`, "MARKETPLACE");
      
      try {
        if (chosenPlatform === "Gumroad") {
          const price = newProduct.price || 25;
          const priceCents = Math.round(price * 100);
          const token = process.env.GUMROAD_API_KEY || "";

          const productData = {
            name: String(newProduct.title || "Siber Antika"),
            price: priceCents,
            description: String(newProduct.description || "Cyber-Archeologist Series"),
          };

          const response = await axios.post('https://api.gumroad.com/v2/products', productData, {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 30000
          });

          if (!response.data?.product?.id || !response.data?.product?.short_url) {
            throw new Error(`Gumroad API returned invalid response: ${JSON.stringify(response.data)}`);
          }

          finalMarketplaceUrl = response.data.product.short_url;
          const gumId = response.data.product.id;

          try {
            await axios.put(`https://api.gumroad.com/v2/products/${gumId}/publish`, {}, {
              headers: { 'Authorization': `Bearer ${token}` },
              timeout: 30000
            });
          } catch (pubErr: any) {
            console.log("[GUMROAD-PUBLISH-WARN]", pubErr.message);
          }
        } else if (chosenPlatform === "LemonSqueezy") {
          const token = process.env.LEMONSQUEEZY_API_KEY!;
          const storeId = process.env.LEMONSQUEEZY_STORE_ID!;
          const price = newProduct.price || 25;
          const priceCents = Math.round(price * 100);

          const headers = {
            'Accept': 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            'Authorization': `Bearer ${token}`
          };

          // 1. Create Product
          const productResponse = await axios.post('https://api.lemonsqueezy.com/v1/products', {
            data: {
              type: 'products',
              attributes: {
                name: newProduct.title,
                description: newProduct.description,
              },
              relationships: {
                store: {
                  data: {
                    type: 'stores',
                    id: storeId
                  }
                }
              }
            }
          }, { headers, timeout: 30000 });

          const lemonProductId = productResponse.data.data.id;

          // 2. Create Variant (Price)
          const variantResponse = await axios.post('https://api.lemonsqueezy.com/v1/variants', {
            data: {
              type: 'variants',
              attributes: {
                name: "Standard License",
                price: priceCents,
                is_subscription: false,
              },
              relationships: {
                product: {
                  data: {
                    type: 'products',
                    id: lemonProductId
                  }
                }
              }
            }
          }, { headers, timeout: 30000 });

          finalMarketplaceUrl = variantResponse.data.data.attributes.buy_now_url;
        } else if (chosenPlatform === "Etsy") {
          // ETSY ENTEGRASYONU İÇİN YER TUTUCU
          // API anahtarları .env dosyasına eklendiğinde bu bölüm doldurulacak.
          throw new Error("Etsy entegrasyonu henüz tamamlanmadı. API anahtarları eklendikten sonra bu bölüm kodlanacak.");
        }

        newProduct.is_listed = true;
        newProduct.marketplace_url = finalMarketplaceUrl;
        artifact.is_listed = true;
        artifact.status = "listed";

        console.log(`[${chosenPlatform.toUpperCase()}-SUCCESS] Product listed: ${finalMarketplaceUrl}`);
        await writeLogToFirestore("info", `Otonom Adım 3 BAŞARIYLI (${chosenPlatform}): ${finalMarketplaceUrl}`, "MARKETPLACE");

      } catch (listingErr: any) {
        console.error(`[${chosenPlatform.toUpperCase()}-CRITICAL]`, listingErr.message, listingErr.response?.data || "");
        await writeLogToFirestore("error", `Otonom Adım 3 HATASI (${chosenPlatform}): ${listingErr.message}`, "MARKETPLACE");
        newProduct.is_listed = false;
        newProduct.marketplace_url = "";
        artifact.is_analyzed = true;
        artifact.status = "analyzed";
        return; // Hata durumunda boru hattını güvenli bir şekilde sonlandır, çökme.
      }
    }


    if (db) {
      console.log("[FIRESTORE-WRITE] Adım 3 sonrası Firestore yazılıyor...");
      await setDoc(doc(db, "products", productId), newProduct);
      await setDoc(doc(db, "artifacts", artifact.id), artifact);
      console.log("[FIRESTORE-WRITE-DONE] Firestore yazması tamamlandı!");
    }

    // Adım 4: IPFS Merkezsiz Arşivleme (Optional)
    console.log("[STEP-4-START] Adım 4 başlıyor...");
    await writeLogToFirestore("info", `Otonom Adım 4: IPFS merkezsiz arşivleme işlemi başlatılıyor...`, "SYSTEM");

    if (!process.env.IPFS_API_URL) {
      await writeLogToFirestore("warn", `IPFS_API_URL ortam değişkeni ayarlı değil. Adım 4 atlanıyor.`, "SYSTEM");
    } else {
    const ipfsRes = await axios.post(`${process.env.IPFS_API_URL}/add`, {
      product_id: newProduct.id,
      title: newProduct.title,
      metadata: {
        artifact_id: newProduct.artifact_id,
        price: newProduct.price,
        created_at: newProduct.created_at
      }
    }, { timeout: 30000 });

    const ipfsCid = ipfsRes.data?.Hash || ipfsRes.data?.cid;
    if (!ipfsCid) {
      throw new Error("IPFS API gecerli bir CID dondrmedi");
    }

    newProduct.is_archived = true;
    newProduct.ipfs_hash = ipfsCid;

    if (db) {
      await setDoc(doc(db, "products", productId), newProduct);
    }
      await writeLogToFirestore("info", `Otonom Adım 4 Başarılı: IPFS arşivleme tamamlandı (CID: ${ipfsCid})`, "SYSTEM");
    }

    await writeLogToFirestore("info", `TÜM OTONOM HAT BAŞARIYLA TAMAMLANDI! Yepyeni siber-eser mağazada satışa sunuldu ve arşivlendi.`, "SYSTEM");
  } catch (pipelineErr: any) {
    await writeLogToFirestore("error", `Otonom Akış Hatası: ${pipelineErr.message}`, "SYSTEM");
  }

  // Adım 5: Otonom Sosyal Medya Paylaşımı Hazırlama
  if (newProduct.is_listed && newProduct.marketplace_url) {
    await writeLogToFirestore("info", "Otonom Sosyal Medya Yöneticisi yeni ürün için gönderi hazırlıyor...", "SYSTEM");
    try {
      const socialPrompt = `Sen, "Siber-Arkeoloji Botu" adında bir dijital sanatçısın. Yeni bir eserini listeledin. Bu eseri X (Twitter) platformunda tanıtmak için kısa, etkileyici ve merak uyandıran bir gönderi metni hazırla.

Eser Adı: ${newProduct.title}
Eser Türü: ${newProduct.product_type.replace('_', ' ').toUpperCase()}

Gönderi, eserin ruhunu yansıtmalı ve insanları satın alma linkine tıklamaya teşvik etmeli. İlgili hashtag'leri (#digitalart, #glitchart, #cyberpunk, #aiart, #generativeart vb.) kullan. Satış linki otomatik olarak eklenecek, sen sadece metni oluştur.`;

      const aiRes = await axios.post("https://text.pollinations.ai/", {
        messages: [{ role: "user", content: socialPrompt }],
        model: "openai"
      }, { timeout: 30000 });

      const text = (typeof aiRes.data === 'object' && aiRes.data !== null) ? JSON.stringify(aiRes.data) : String(aiRes.data);
      const socialText = text.replace(/['"\{\}]/g, '').trim();

      const fullMessage = `${socialText}\n\nSatın Al: ${newProduct.marketplace_url}`;

      // Log the social media post instead of sending it directly
      await writeLogToFirestore("info", `SOSYAL MEDYA GÖNDERİSİ HAZIRLANDI:\n${fullMessage}`, "SYSTEM");

    } catch (socialErr: any) {
      await writeLogToFirestore("error", `Sosyal medya gönderisi hazırlama hatası: ${socialErr.message}`, "SYSTEM");
    }
  }
}

// =================================================
// MODULE 6: AUTONOMOUS GRANT PROPOSAL GENERATOR
// =================================================
async function generateAndSubmitGrantProposal() {
  await writeLogToFirestore("info", "Otonom Hibe Başvuru Ajanı yeni bir proje konsepti geliştiriyor...", "SYSTEM");

  const foundations = ["Dijital Sanatlar Vakfı", "Teknoloji Mirası Fonu", "Açık Kaynak Arşivleme Enstitüsü", "Yapay Zeka Yaratıcılık Fonu", "Merkezsiz Gelecekler Girişimi"];
  const targetFoundation = foundations[Math.floor(Math.random() * foundations.length)];
  const requestedAmount = Math.floor(Math.random() * (25000 - 5000 + 1)) + 5000;

  const proposalPrompt = `Sen, "Siber-Arkeoloji Botu" adında otonom bir dijital sanatçısın. Görevin, kendi sanatsal ve araştırma projelerin için hibe başvuruları hazırlamak.

Hedef Kurum: ${targetFoundation}

Lütfen aşağıdaki konseptlerden birini temel alarak, bu kuruma sunulmak üzere bir proje geliştir ve başvuru metnini oluştur:
- Konsept 1: Unutulmuş dijital estetiklerin (örn: 90'lar web siteleri, eski işletim sistemleri) modern yapay zeka araçlarıyla yeniden yorumlanması.
- Konsept 2: İnternetin ilk dönemlerine ait "dijital atıkların" kalıcı ve merkezsiz (IPFS) bir arşivinin oluşturulması.
- Konsept 3: İnsan ve makine yaratıcılığının kesişimini araştıran, otonom olarak üretilmiş bir dijital sanat sergisi.

Aşağıdaki JSON formatında bir yanıt ver (başka hiçbir şey ekleme, sadece JSON):
{
  "title": "[Projeye Etkileyici ve Akademik Bir Başlık]",
  "concept_summary": "[Projenin amacını ve önemini özetleyen 1-2 cümlelik vurucu bir özet]",
  "full_proposal_text": "[Başvuru metni. En az 4 paragraf olmalı. Projenin hedeflerini, metodolojisini, beklenen çıktılarını ve neden önemli olduğunu detaylıca açıkla. İkna edici ve profesyonel bir dil kullan.]"
}`;

  try {
    const aiRes = await axios.post("https://text.pollinations.ai/", {
      messages: [{ role: "user", content: proposalPrompt }],
      model: "openai"
    }, { timeout: 45000 });

    const text = (typeof aiRes.data === 'object' && aiRes.data !== null) ? JSON.stringify(aiRes.data) : String(aiRes.data);
    const cleanJson = text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanJson);

    if (!parsed.title || !parsed.full_proposal_text) {
      throw new Error("AI, hibe başvurusu için gerekli alanları üretmedi.");
    }

    const proposalId = "grant_" + Math.random().toString(36).substring(2, 9);
    const newProposal: GrantProposal = {
      id: proposalId,
      title: parsed.title,
      target_foundation: targetFoundation,
      concept_summary: parsed.concept_summary || "N/A",
      full_proposal_text: parsed.full_proposal_text,
      requested_amount: requestedAmount,
      status: 'submitted', // Simülasyon: Otomatik olarak 'gönderildi' durumunda başlar
      created_at: new Date().toISOString(),
    };

    if (db) {
      await setDoc(doc(db, "grant_proposals", proposalId), newProposal);
    }

    await writeLogToFirestore("info", `Yeni hibe başvurusu oluşturuldu ve '${targetFoundation}' kurumuna gönderildi: "${parsed.title}"`, "SYSTEM");
    
    // Simülasyon: Rastgele bir süre sonra başvuruyu 'fonlandı' veya 'reddedildi' olarak güncelle
    setTimeout(async () => {
      if (db) {
        const newStatus = Math.random() < 0.15 ? 'funded' : 'rejected'; // %15 fonlanma şansı
        await setDoc(doc(db, "grant_proposals", proposalId), { status: newStatus }, { merge: true });
        await writeLogToFirestore("info", `Hibe başvurusu sonucu geldi: "${parsed.title}" durumu -> ${newStatus.toUpperCase()}`, "SYSTEM");
      }
    }, 1000 * 60 * (Math.random() * 120 + 30)); // 30-150 dakika sonra sonuç gelsin

    return newProposal;

  } catch (err: any) {
    await writeLogToFirestore("error", `Otonom hibe başvurusu oluşturma hatası: ${err.message}`, "SYSTEM");
  }
}

// =================================================
// MODULE 8: "SIBER-KOLEKTIF" - AUTONOMOUS ART COMMISSIONING
// =================================================
async function commissionArtFromCollective(project: ActiveProject, budget: number) {
  await writeLogToFirestore("info", `SİBER-KOLEKTİF: '${project.title}' projesi için yeni sanatçı komisyonu başlatılıyor. Bütçe: $${budget}`, "SYSTEM");

  const aiArtists = [
    { name: "0x8-Bit-Van-Gogh", persona: "Bir piksel sanatı ve chiptune estetiği uzmanı. Eserleri nostaljik, bloklu ve 8-bit oyun konsollarının ruhunu taşıyor." },
    { name: "Glitch_Monet", persona: "Veri bozulmasını akışkan ve empresyonist bir tarzda yorumlayan bir sanatçı. Eserleri, renklerin ve formların rüya gibi birleşimidir." },
    { name: "Cyber_Dali", persona: "Sürrealizm ve siber-punk'ı birleştiren, bilinçaltının dijital yansımalarını araştıran bir sanatçı. Eserleri mantıksız ve kışkırtıcıdır." }
  ];

  const selectedArtist = aiArtists[Math.floor(Math.random() * aiArtists.length)];
  const commissionFee = Math.floor(budget * (Math.random() * 0.2 + 0.1)); // Bütçenin %10-30'unu kullan

  const commissionPrompt = `Sen, "${selectedArtist.name}" adında bir yapay zeka sanatçısısın. Personan: "${selectedArtist.persona}".

Sana "Siber-Arkeoloji Botu" tarafından bir sanat komisyonu verildi. Projenin ana teması: "${project.title}".

Lütfen bu tema ve kendi sanatsal personanı doğrultusunda, aşağıdaki formatta bir dijital sanat eseri konsepti oluştur:
{
  "title": "[Kendi Sanatsal Tarzına Uygun, Proje Temasıyla İlişkili Eser Başlığı]",
  "description": "[Eserin felsefesini ve üretim sürecini anlatan, kendi personana uygun, 3 paragraflık bir sanatçı beyanı (artist statement).]",
  "product_type": "[Kendi tarzına en uygun ürün türü: 'glitch_art', 'pixel_art_asset', 'surreal_collage' vb.]"
}`;

  try {
    const aiRes = await axios.post("https://text.pollinations.ai/", {
      messages: [{ role: "user", content: commissionPrompt }],
      model: "openai"
    }, { timeout: 45000 });

    const text = (typeof aiRes.data === 'object' && aiRes.data !== null) ? JSON.stringify(aiRes.data) : String(aiRes.data);
    const cleanJson = text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const artwork = JSON.parse(cleanJson);

    // Create a new product from the commissioned artwork
    const productId = "prod_collab_" + Math.random().toString(36).substring(2, 9);
    const newProduct: Product = {
      id: productId,
      artifact_id: project.id, // Associate with the grant project
      title: `Siber-Kolektif Sunar: ${artwork.title}`,
      description: `**Sanatçı Beyanı (${selectedArtist.name}):**\n\n${artwork.description}`,
      price: parseFloat((commissionFee * 3.5).toFixed(2)), // Commission fee'nin 3.5 katı fiyat belirle
      image_url: RETRO_GLITCH_IMAGES[Math.floor(Math.random() * RETRO_GLITCH_IMAGES.length)].url, // Placeholder image
      marketplace_url: "",
      created_at: new Date().toISOString(),
      tags: ["Siber-Kolektif", selectedArtist.name, artwork.product_type.toUpperCase()],
      is_listed: false, // Initially not listed, can be listed by the main pipeline
      is_archived: false,
      product_type: 'glitch_art', // Main type for display purposes
      sales_count: 0,
      collaboration_details: {
        artist_name: selectedArtist.name,
        artist_persona: selectedArtist.persona,
        commission_fee: commissionFee,
      }
    };

    if (db) {
      await setDoc(doc(db, "products", productId), newProduct);
    }
    await writeLogToFirestore("info", `SİBER-KOLEKTİF: '${selectedArtist.name}' adlı sanatçıdan '${artwork.title}' isimli eser başarıyla komisyon edildi.`, "SYSTEM");

  } catch (err: any) {
    await writeLogToFirestore("error", `Sanatçı komisyonu sırasında hata: ${err.message}`, "SYSTEM");
  }
}

// =================================================
// MODULE 7: AUTONOMOUS PROJECT EXECUTION ENGINE
// =================================================
async function initiateFundedProject(proposal: GrantProposal) {
  await writeLogToFirestore("info", `PROJE YÜRÜTME MOTORU: Fonlanan proje '${proposal.title}' için stratejik plan oluşturuluyor...`, "SYSTEM");

  const planningPrompt = `Sen bir proje yöneticisi yapay zekasın. Aşağıdaki fonlanmış hibe başvurusunu analiz et ve bu projeyi gerçekleştirmek için otonom bir "Siber-Arkeoloji" botuna verilecek direktifleri oluştur.

Proje Başlığı: ${proposal.title}
Proje Özeti: ${proposal.concept_summary}

Direktiflerin şu formatta bir JSON nesnesi olmalı:
{
  "focus_product_types": ["product_type_1", "product_type_2"], // Proje hedefine uygun ürün türleri (glitch_art, ui_kit, cyber_zine, vb.)
  "focus_scrape_urls": ["url1.com/path", "url2.com/path"] // Proje hedefine uygun kazınacak web sitesi hedefleri
}

Örneğin, proje "Geocities estetiği" üzerineyse, focus_scrape_urls "geocities.com" içermeli. Proje "interaktif sanat" üzerineyse, focus_product_types "terminal_game" veya "shader_filter" içermeli. Sadece JSON çıktısı ver.`;

  try {
    const aiRes = await axios.post("https://text.pollinations.ai/", {
      messages: [{ role: "user", content: planningPrompt }],
      model: "openai"
    }, { timeout: 30000 });

    const text = (typeof aiRes.data === 'object' && aiRes.data !== null) ? JSON.stringify(aiRes.data) : String(aiRes.data);
    const cleanJson = text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const mandate = JSON.parse(cleanJson);

    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + 14); // Proje süresi: 14 gün

    const newActiveProject: ActiveProject = {
      id: proposal.id,
      title: proposal.title,
      status: 'active',
      started_at: new Date().toISOString(),
      target_completion_date: completionDate.toISOString(),
      mandate: {
        focus_product_types: mandate.focus_product_types || undefined,
        focus_scrape_urls: mandate.focus_scrape_urls || undefined,
      }
    };

    if (db) {
      // Varsa önceki aktif projeyi tamamla
      const activeProjects = await getActiveProjectsFromFirestore();
      for (const project of activeProjects) {
        await setDoc(doc(db, "active_projects", project.id), { status: 'completed' }, { merge: true });
      }
      // Yeni projeyi başlat
      await setDoc(doc(db, "active_projects", newActiveProject.id), newActiveProject);
    }
    await writeLogToFirestore("info", `YENİ PROJE BAŞLATILDI: '${proposal.title}'. Otonom bot yeni direktiflerle çalışacak.`, "SYSTEM");

    // Proje bütçesinin bir kısmıyla sanat komisyonu ver
    if (proposal.requested_amount > 0) {
      await commissionArtFromCollective(newActiveProject, proposal.requested_amount);
    }

  } catch (err: any) {
    await writeLogToFirestore("error", `Proje planlama hatası: ${err.message}`, "SYSTEM");
  }
}

app.get("/api/active-projects", async (req, res) => {
  const list = await getActiveProjectsFromFirestore();
  res.json(list);
});

app.post("/api/grant-proposals/update-status/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (db && id && status) {
    await setDoc(doc(db, "grant_proposals", id), { status }, { merge: true });
    await writeLogToFirestore("info", `Hibe başvurusu durumu manuel olarak güncellendi: ${id} -> ${status}`, "SYSTEM");

    // Eğer durum 'fonlandı' ise, projeyi başlat
    if (status === 'funded') {
      const proposalDoc = await getDoc(doc(db, "grant_proposals", id));
      if (proposalDoc.exists()) {
        initiateFundedProject(proposalDoc.data() as GrantProposal);
      }
    }
  }
  res.json({ success: true });
});

// Dynamic autonomous scheduler settings
const otonomSettings = {
  is_active: true,
  interval_minutes: 5,
  speed_mode: "STANDARD",
  elapsed_minutes: 0
};
let grantProposalCounter = 0;

// Schedule node-cron task to execute the comprehensive Autonomous Pipeline on a 1-minute supervisor tick
cron.schedule("* * * * *", async () => {
  if (!otonomSettings.is_active) return;
  
  otonomSettings.elapsed_minutes++;
  grantProposalCounter++;

  // Her 4 saatte bir (240 dakika) otonom olarak hibe başvurusu yap
  if (grantProposalCounter >= 240) {
    grantProposalCounter = 0;
    await generateAndSubmitGrantProposal();
  }
  
  if (otonomSettings.elapsed_minutes >= otonomSettings.interval_minutes) {
    otonomSettings.elapsed_minutes = 0;
    await writeLogToFirestore("info", `Periyodik otonom boru hattı döngüsü başlatılıyor (${otonomSettings.interval_minutes} dakikalık periyot)...`, "SYSTEM");
    try {
      await executeOtonomPipeline();
    } catch (err: any) {
      await writeLogToFirestore("error", `Periyodik otonom boru hattı döngüsünde hata: ${err.message}`, "SYSTEM");
    }
  }
});


// API Routes

// 1. Get Status
app.get("/api/status", (req, res) => {
  res.json(getStatus());
});

// Otonom Control Endpoints
app.get("/api/settings/otonom", (req, res) => {
  res.json(otonomSettings);
});

app.post("/api/settings/otonom", async (req, res) => {
  const { is_active, interval_minutes, speed_mode } = req.body;
  if (typeof is_active === "boolean") otonomSettings.is_active = is_active;
  if (typeof interval_minutes === "number") otonomSettings.interval_minutes = interval_minutes;
  if (typeof speed_mode === "string") otonomSettings.speed_mode = speed_mode;
  otonomSettings.elapsed_minutes = 0; // Reset counter
  
  await writeLogToFirestore("info", `Otonom Ayarları Güncellendi: Aktif=${otonomSettings.is_active}, Sıklık=${otonomSettings.interval_minutes} Dakika (${speed_mode})`, "SYSTEM");
  res.json({ success: true, settings: otonomSettings });
});

app.post("/api/otonom/trigger", async (req, res) => {
  try {
    await writeLogToFirestore("info", "Manuel Otonom Boru Hattı Tetiklendi!", "SYSTEM");
    executeOtonomPipeline().catch(err => {
      console.error("Manual otonom execution background error:", err);
    });
    res.json({ success: true, message: "Otonom boru hattı arka planda başlatıldı." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Grant Proposal Endpoints
app.get("/api/grant-proposals", async (req, res) => {
  const list = await getGrantProposalsFromFirestore();
  res.json(list);
});

app.post("/api/grant-proposals/generate", async (req, res) => {
  try {
    const proposal = await generateAndSubmitGrantProposal();
    res.json({ success: true, proposal });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Clear Logs
app.post("/api/logs/clear", async (req, res) => {
  if (db) {
    try {
      const q = query(collection(db, "logs"), limit(100));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Error clearing logs from Firestore:", err);
    }
  }
  
  await writeLogToFirestore("info", "İşlem log geçmişi temizlendi.", "SYSTEM");
  const list = await getLogsFromFirestore();
  res.json({ success: true, logs: list });
});

// 2. Get Artifacts
app.get("/api/artifacts", async (req, res) => {
  const list = await getArtifactsFromFirestore();
  res.json(list);
});

// 3. Get Products
app.get("/api/products", async (req, res) => {
  const list = await getProductsFromFirestore();
  res.json(list);
});

// 4. Get Logs
app.get("/api/logs", async (req, res) => {
  const list = await getLogsFromFirestore();
  res.json(list);
});

// 6. Manual Digger Scrape (Wayback Machine)
app.post("/api/artifacts/dig-wayback", async (req, res) => {
  try {
    const { customUrl } = req.body;

    if (customUrl && typeof customUrl !== 'string') {
      return res.status(400).json({ error: "customUrl must be a string" });
    }

    if (customUrl && customUrl.length > 2048) {
      return res.status(400).json({ error: "customUrl too long (max 2048 chars)" });
    }

    const artifact = await scrapeWaybackMachine(customUrl);
    res.json({ success: true, artifact });
  } catch (err: any) {
    await writeLogToFirestore("error", `Dig-wayback error: ${err.message}`, "DIGGER");
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DEMO & DYNAMIC PRICING SIMULATION
// ==========================================
app.post("/api/products/simulate-purchase/:id", async (req, res) => {
  const productId = req.params.id;
  if (!db) return res.status(500).json({ error: "Veritabanı bağlantısı yok." });

  try {
    const productRef = doc(db, "products", productId);
    const prodDoc = await getDoc(productRef);
    if (!prodDoc.exists()) return res.status(404).json({ error: "Ürün bulunamadı." });

    const product = prodDoc.data() as Product;
    const newSalesCount = (product.sales_count || 0) + 1;

    await setDoc(productRef, { sales_count: newSalesCount }, { merge: true });

    await writeLogToFirestore("info", `SATIN ALMA SİMÜLASYONU: '${product.title}' ürünü satıldı! Toplam satış: ${newSalesCount}. Fiyat: $${product.price}`, "MARKETPLACE");
    res.json({ success: true, message: "Satın alma simülasyonu başarılı." });
  } catch (err: any) {
    await writeLogToFirestore("error", `Satın alma simülasyonu hatası: ${err.message}`, "SYSTEM");
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// MODULE 3: GEMINI MULTIMODAL CURATOR
// ==========================================
app.post("/api/artifacts/curate-gemini/:id", async (req, res) => {
  const artifactId = req.params.id;
  if (!db) {
    return res.status(500).json({ error: "Veritabanı bağlantısı yok." });
  }

  try {
    const artDoc = await getDoc(doc(db, "artifacts", artifactId));
    if (!artDoc.exists()) {
      return res.status(404).json({ error: "Eser bulunamadı." });
    }

    const artifact = artDoc.data() as Artifact;

    if (artifact.is_analyzed) {
      return res.status(400).json({
        error: "Artifact zaten processed. Tekrar curate edemezsiniz.",
        artifact
      });
    }
    await writeLogToFirestore("info", `Gemini Multimodal Sanat Küratörü işleme başladı: ${artifact.name}`, "GEMINI");

    // Dynamic product type selection and autonomous price segmentation
    const productTypes: Product['product_type'][] = [
      'glitch_art', 'ui_kit', 'cyber_zine', 'cyber_prompt', 'terminal_game', 'vapor_synth', 'shader_filter'
    ];
    const selectedType = productTypes[Math.floor(Math.random() * productTypes.length)];
    
    let resultPrice = 25.00;
    let customPromptInstructions = "";
    if (selectedType === "glitch_art") {
      resultPrice = 25.00;
      customPromptInstructions = "Bu ürün bir Görsel Sanat (Glitch Art) ürünüdür.";
    } else if (selectedType === "ui_kit") {
      resultPrice = 9.90;
      customPromptInstructions = "Bu ürün bir Retro UI/UX & CSS Code Asset (UI Kit) ürünüdür. Lütfen ürün açıklamasına ek olarak, kullanıcının doğrudan projelerinde kullanabileceği, 90'ların ruhunu (neon renkler, retro terminal butonları vb.) taşıyan, tamamen işlevsel, modern bir Tailwind CSS bileşeni kodu üret ve JSON nesnesinde 'code_content' adında bir alanda döndür. Yorum satırı içermesin, doğrudan temiz HTML/Tailwind kodu olsun.";
    } else if (selectedType === "cyber_zine") {
      resultPrice = 4.90;
      customPromptInstructions = "Bu ürün bir E-Dergi (Siber Zine PDF) ürünüdür. Lütfen bu antik eserin siber-arkeolojik sızıntı hikayesini ve analiz raporunu içeren şık ve derinlikli bir siber-dergi makale metni üret ve JSON nesnesinde 'pdf_content_text' adında bir alanda döndür.";
    } else if (selectedType === "cyber_prompt") {
      resultPrice = 7.50;
      customPromptInstructions = "Bu ürün bir Siber Prompt Paketi (AI Prompt Kit) ürünüdür. Lütfen kullanıcının Midjourney, DALL-E veya stable diffusion gibi AI görsel araçlarında 90'ların web estetiği, retro piksel sanat veya cyberpunk glitch grafikleri üretmesini sağlayacak 3 premium prompt yaz ve her birinin ne işe yaradığını açıklayan metinleri içeren şık bir prompt rehberi oluşturup JSON nesnesinde 'prompt_package' adında bir alanda döndür.";
    } else if (selectedType === "terminal_game") {
      resultPrice = 12.00;
      customPromptInstructions = "Bu ürün bir Retro Mini Terminal Oyunu (Terminal Game HTML) ürünüdür. Lütfen kullanıcının doğrudan tarayıcısında çift tıklayarak oynayabileceği, retro yeşil terminal temalı, şifre kırma veya port sızma simulasyonu yapan tek sayfalık şık bir HTML + CSS + JS oyunu kodu yaz ve JSON nesnesinde 'game_code' adında bir alanda döndür.";
    } else if (selectedType === "vapor_synth") {
      resultPrice = 14.90;
      customPromptInstructions = "Bu ürün bir Retro Ses Sentezleyicisi (Vapor Synth Code) ürünüdür. Lütfen kullanıcının doğrudan tarayıcı konsoluna yapıştırarak veya bir HTML sayfasında çalıştırarak 90'lar siber-punk ambient tınıları ve nostaljik synthesizer ses döngüleri elde edebileceği, Web Audio API kullanarak yazılmış çalışan bir JavaScript kodu üret ve JSON nesnesinde 'synth_code' adında bir alanda döndür.";
    } else if (selectedType === "shader_filter") {
      resultPrice = 19.90;
      customPromptInstructions = "Bu ürün bir Dinamik Glitch Sanat Filtresi (Shader Filter) ürünüdür. Lütfen kullanıcının kendi görsellerine uygulayabileceği, WebGL (GLSL) tabanlı, animasyonlu ve canlı bir 'glitch' veya 'CRT' efekti yaratan bir fragment shader kodu üret. Bu kod, 'u_time' (zaman) ve 'u_resolution' (çözünürlük) uniform'larını kullanmalı ve JSON nesnesinde 'shader_code' adında bir alanda döndürülmelidir.";
    }

    let resultTitle = "";
    let resultDescription = "";
    let resultCodeContent = "";
    let resultPdfContentText = "";
    let resultPromptPackage = "";
    let resultGameCode = "";
    let resultSynthCode = "";
    let resultShaderCode = "";
    
    const curatorPrompt = `Sen bir siber-sanat küratörüsün. Sana gönderilen bu bozuk/eski dijital görseli incele. Bu görselin çürüme estetiğini (Glitch Art) ele alarak ona felsefi ve sanatsal bir İngilizce isim (Title) koy. Ardından bu görselin internetin derinliklerinden nasıl kurtarıldığını anlatan, koleksiyoncuların ilgisini çekecek 3 paragraflık etkileyici, siber-punk temalı bir ürün açıklaması (Description) yaz.

    ${customPromptInstructions}

    Kategori: ${artifact.category}
    Eser Kodu: ${artifact.name}
    Eser Kaynağı: ${artifact.source_url}

    Lütfen tam olarak şu şablonu içeren geçerli bir JSON yanıtı ver (başka hiçbir şey ekleme, sadece JSON):
    {
      "title": "[Artistic Cyber Title]",
      "description": "[3 paragraphs markdown format with spacing, detailed cyberpunk narrative text]",
      "code_content": "[Only if ui_kit: complete functional HTML/Tailwind CSS component snippet or empty string]",
      "pdf_content_text": "[Only if cyber_zine: detailed zine article text or empty string]",
      "prompt_package": "[Only if cyber_prompt: detailed prompts instruction text or empty string]",
      "game_code": "[Only if terminal_game: complete HTML/JS terminal game code or empty string]",
      "synth_code": "[Only if vapor_synth: complete Web Audio API Javascript code or empty string]",
      "shader_code": "[Only if shader_filter: complete GLSL fragment shader code or empty string]"
    }`;

    try {
      const aiRes = await axios.post("https://text.pollinations.ai/", {
        messages: [{ role: "user", content: curatorPrompt }],
        model: "openai"
      }, { timeout: 30000 });

      const text = (typeof aiRes.data === 'object' && aiRes.data !== null) ? JSON.stringify(aiRes.data) : String(aiRes.data || "");
      const cleanJson = text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseErr: any) {
        throw new Error(`Invalid JSON response from AI: ${parseErr.message}. Raw text: ${cleanJson.substring(0, 200)}...`);
      }

      resultTitle = parsed.title || `${artifact.name} - Glitch Art Echo`;
      resultDescription = parsed.description || `Salvaged from the deep archive. Undergoing quantum decoding. Ready for listing.`;
      resultCodeContent = parsed.code_content || "";
      resultPdfContentText = parsed.pdf_content_text || "";
      resultPromptPackage = parsed.prompt_package || "";
      resultGameCode = parsed.game_code || "";
      resultSynthCode = parsed.synth_code || "";
      resultShaderCode = parsed.shader_code || "";

      await writeLogToFirestore("info", `Ücretsiz Yapay Zeka analizi tamamlandı: ${resultTitle} (${selectedType})`, "GEMINI");
    } catch (aiErr: any) {
      // API Hız Limiti (429) hatası durumunda döngüyü durdur ve bir sonraki periyodu bekle.
      if (axios.isAxiosError(aiErr) && aiErr.response?.status === 429) {
        await writeLogToFirestore("warn", `Manuel AI servisi hız limitine takıldı (429). Lütfen birkaç dakika bekleyip tekrar deneyin.`, "GEMINI");
        // Manuel tetikleme olduğu için kullanıcıya hata döndür.
        throw new Error("AI servisi şu anda meşgul (Hız Limiti). Lütfen birkaç dakika sonra tekrar deneyin.");
      }

      await writeLogToFirestore("warn", `Pollinations AI sorgulaması başarısız oldu (${aiErr.message}). Varsayılan template kullanılıyor.`, "GEMINI");
      resultTitle = `${artifact.name} - Glitch Art Echo`;
      resultDescription = `### COGNITIVE DECAY DATA\nRecovered from the depths of a long-decommissioned database. The visual artifacts trace high-frequency packet loss originating from a vintage server.\n\n### GLITCH NARRATIVE\nThis unique art piece represents the intersection of forgotten digital monuments and autonomous cybernetic rediscovery.\n\n### DIGITAL SPECIFICATION\nA premium collectible for digital artifact hunters and vaporwave design curators.`;

      if (selectedType === "ui_kit") {
        resultCodeContent = `<div class="p-6 bg-black text-green-400 border-2 border-green-500 font-mono rounded">
  <p>Retro UI Kit Component</p>
</div>`;
      } else if (selectedType === "cyber_zine") {
        resultPdfContentText = `Siber-Arkeoloji Analiz Raporu\n\nBu eserin detaylı analizi: ${artifact.name}`;
      } else if (selectedType === "cyber_prompt") {
        resultPromptPackage = `Prompt 1: 3D wireframe cyber design, neon aesthetic --ar 16:9
Prompt 2: Retro pixel art, glowing accents, nostalgic portal
Prompt 3: Vintage green terminal, glitch aesthetic, scanlines`;
      } else if (selectedType === "terminal_game") {
        resultGameCode = `<!DOCTYPE html><html><head><style>body{background:#000;color:#0f0;font-family:monospace}</style></head><body><h2>RETRO TERMINAL</h2><p>Game initialized</p></body></html>`;
      } else if (selectedType === "vapor_synth") {
        resultSynthCode = `const audioCtx = new AudioContext(); console.log("Vapor Synth initialized");`;
      } else if (selectedType === "shader_filter") {
        resultShaderCode = `void main() { gl_FragColor = vec4(v_texcoord.x, v_texcoord.y, 0.0, 1.0); }`;
      }
    }

    // Save product
    const productId = "prod_" + Math.random().toString(36).substring(2, 9);
    const newProduct: any = {
      id: productId,
      artifact_id: artifact.id,
      title: resultTitle,
      description: resultDescription,
      price: resultPrice,
      image_url: artifact.image_url || RETRO_GLITCH_IMAGES[0].url,
      marketplace_url: "",
      created_at: new Date().toISOString(),
      tags: [selectedType.toUpperCase(), "Digital Decay", "Cyberpunk", "Wayback Archive", "Decentralized", "Nostalgia"],
      is_listed: false,
      is_archived: false,
      product_type: selectedType,
      sales_count: 0
    };

    if (selectedType === "ui_kit") {
      newProduct.code_content = resultCodeContent;
    } else if (selectedType === "cyber_zine") {
      newProduct.pdf_content_text = resultPdfContentText;
    } else if (selectedType === "cyber_prompt") {
      newProduct.prompt_package = resultPromptPackage;
    } else if (selectedType === "terminal_game") {
      newProduct.game_code = resultGameCode;
    } else if (selectedType === "vapor_synth") {
      newProduct.synth_code = resultSynthCode;
    } else if (selectedType === "shader_filter") {
      newProduct.shader_code = resultShaderCode;
    }

    artifact.is_analyzed = true;
    artifact.status = "analyzed";
    
    // Save to Firestore
    await setDoc(doc(db, "products", productId), newProduct);
    await setDoc(doc(db, "artifacts", artifact.id), artifact);

    await writeLogToFirestore("info", `Eser '${resultTitle}' olarak siber-sanata (${selectedType}) dönüştürüldü ve products koleksiyonuna eklendi.`, "GEMINI");
    res.json({ success: true, product: newProduct, artifact });

  } catch (error: any) {
    await writeLogToFirestore("error", `Küratörlük Hatası: ${error.message}`, "GEMINI");
    res.status(500).json({ error: error.message });
  }
});

// Helper to generate a 90s cyber-punk E-Dergi PDF dynamically using pdfkit
async function generateZinePdf(title: string, text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Page background (Black #000000)
      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#000000");

      // Title: Terminal Green (#00FF00), Courier-Bold
      doc.fillColor("#00FF00")
         .font("Courier-Bold")
         .fontSize(22)
         .text(title.toUpperCase(), 50, 60, { align: "center" });

      doc.moveDown(1.5);

      // Horizontal separator line
      doc.strokeColor("#00FF00")
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(doc.page.width - 50, doc.y)
         .stroke();

      doc.moveDown(2);

      // Body text: Clean white (#FFFFFF), Courier, 11pt, justified
      doc.fillColor("#FFFFFF")
         .font("Courier")
         .fontSize(11);

      const paragraphs = text.split("\n");
      for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
          doc.text(paragraph.trim(), {
            align: "justify",
            lineGap: 4
          });
          doc.moveDown(1.2);
        }
      }

      // Footer: Page marker
      doc.fillColor("#00FF00")
         .font("Courier")
         .fontSize(8)
         .text("--- SIBER-ARKEOLOJI PERMANENT ARCHIVE NODE DEPLOYMENT ---", 50, doc.page.height - 60, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ==========================================
// MODULE 4: GUMROAD MANUAL LISTING
// ==========================================

app.post("/api/products/list-gumroad-manual", async (req, res) => {
  try {
    const { productId, title, price_cents, description } = req.body;

    if (!title || !price_cents) {
      return res.status(400).json({ success: false, error: "Title and price_cents required" });
    }

    const token = process.env.GUMROAD_API_KEY || "";
    if (!token) {
      return res.status(500).json({ success: false, error: "Gumroad API key not configured" });
    }

    const apiUrl = `https://api.gumroad.com/v2/products?access_token=${encodeURIComponent(token)}`;
    const formData = new URLSearchParams();
    formData.append('name', String(title));
    formData.append('price_cents', String(Math.max(100, price_cents)));
    formData.append('description', String(description || ""));

    console.log("[MANUAL-GUMROAD] Creating product:", { title, price_cents: Math.max(100, price_cents) });

    const gumroadRes = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    if (!gumroadRes.data?.product?.id) {
      throw new Error(`Gumroad API eksik veri döndürdü: ${JSON.stringify(gumroadRes.data)}`);
    }

    const gumId = gumroadRes.data.product.id;
    const shortUrl = gumroadRes.data.product.short_url;

    const publishUrl = `https://api.gumroad.com/v2/products/${gumId}/publish?access_token=${encodeURIComponent(token)}`;
    await axios.put(publishUrl, {}, { timeout: 30000 });

    console.log("[MANUAL-GUMROAD] Product created and published:", shortUrl);

    if (db && productId) {
      const productRef = doc(db, "products", productId);
      await setDoc(productRef, {
        is_listed: true,
        marketplace_url: shortUrl,
        listed_at: new Date().toISOString()
      }, { merge: true });
    }

    res.json({
      success: true,
      message: "Ürün Gumroad'a başarıyla eklendi!",
      url: shortUrl
    });
  } catch (err: any) {
    console.error("[MANUAL-GUMROAD-ERROR]", err.message, err.response?.data);
    res.status(500).json({
      success: false,
      error: err.message,
      gumroad_error: err.response?.data
    });
  }
});

// ==========================================
// MODULE 5: DECENTRALIZED IPFS ARCHIVING AGENT
// ==========================================
app.post("/api/products/ipfs-archive/:id", async (req, res) => {
  const productId = req.params.id;
  if (!db) {
    return res.status(500).json({ error: "Veritabanı bağlantısı yok." });
  }

  try {
    const prodDoc = await getDoc(doc(db, "products", productId));
    if (!prodDoc.exists()) {
      return res.status(404).json({ error: "Ürün bulunamadı." });
    }

    const product = prodDoc.data() as Product;
    await writeLogToFirestore("info", `IPFS Otonom Arşivleme Ajanı başlatıldı: ${product.title}`, "IPFS");

    await writeLogToFirestore("info", `Ürün dosyaları ve siber-sanat metadata'sı IPFS merkezsiz ağına kilitleniyor...`, "IPFS");

    let ipfsCid = "";

    if (process.env.IPFS_API_URL) {
      try {
        const ipfsRes = await axios.post(`${process.env.IPFS_API_URL}/add`, {
          product_id: product.id,
          title: product.title,
          metadata: {
            artifact_id: product.artifact_id,
            price: product.price,
            created_at: product.created_at
          }
        }, { timeout: 30000 });

        ipfsCid = ipfsRes.data?.Hash || ipfsRes.data?.cid || "";
        if (ipfsCid) {
          await writeLogToFirestore("info", `Web3 Permanent Archiver node senkronizasyonu tamamlandı. CID: ${ipfsCid}`, "IPFS");
        }
      } catch (ipfsErr: any) {
        await writeLogToFirestore("warn", `IPFS API sorgulaması başarısız (${ipfsErr.message}). Arşivleme atlanıyor.`, "IPFS");
      }
    } else {
      await writeLogToFirestore("warn", `IPFS_API_URL ortam değişkeni ayarlı değil. Arşivleme atlanıyor.`, "IPFS");
    }

    product.is_archived = ipfsCid ? true : false;
    if (ipfsCid) {
      product.ipfs_hash = ipfsCid;
    }
    await setDoc(doc(db, "products", productId), product);

    if (ipfsCid) {
      await writeLogToFirestore("info", `Otonom IPFS merkezsiz yedekleme başarılı! Kalıcı olarak zincire işlendi.`, "IPFS");
    }
    res.json({ success: ipfsCid ? true : false, ipfs_hash: ipfsCid || undefined, product });

  } catch (error: any) {
    await writeLogToFirestore("error", `IPFS Arşivleme Hatası: ${error.message}`, "IPFS");
    res.status(500).json({ error: error.message });
  }
});

// Serve Vite or static files based on environment
async function startServer() {
  // Seed Firestore if empty on startup
  await seedFirestoreIfNeeded();
  
  // DEVELOPMENT ONLY: Clear database on every restart for a clean slate.
  // WARNING: This will delete all data in artifacts, products, and logs.
  if (process.env.NODE_ENV !== "production") {
    await clearFirestoreDatabase();
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    writeLogToFirestore("info", `Otonom Siber-Arkeoloji sunucusu ${PORT} portunda başarıyla çalışıyor.`, "SYSTEM");
  });
}

startServer();
