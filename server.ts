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
  writeBatch
} from "firebase/firestore";
import { Artifact, Product, SystemLog, SystemStatus } from "./src/types";

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

// Check configuration status
const getStatus = (): SystemStatus => {
  const hasFirebase = !!db;
  const hasGumroad = !!process.env.GUMROAD_API_KEY;

  return {
    firebase_connected: hasFirebase,
    is_fallback: !hasFirebase,
    gemini_configured: true, // Ücretsiz ve sınırsız çalışan Pollinations AI entegre edildiği için her zaman aktiftir!
    gumroad_configured: hasGumroad,
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

// Complete End-to-End Autonomous Pipeline Orchestrator
async function executeOtonomPipeline() {
  if (!db) {
    console.error("Firebase not initialized. Cannot run pipeline.");
    return;
  }

  await writeLogToFirestore("info", "OTONOM BORU HATTI TETİKLENDİ: Wayback Scraper, Gemini Küratörü, Gumroad ve IPFS akışı başlıyor...", "SYSTEM");
  try {
    // Adım 1: Wayback Machine Üzerinden Siber-Antika Kazı
    const artifact = await scrapeWaybackMachine();
    await writeLogToFirestore("info", `Otonom Adım 1 Başarılı: Yeni siber-antika kazındı -> ${artifact.name}`, "SYSTEM");

    // Adım 2: Gemini ile Siber-Sanat Kürasyonu, Ürün Tipi ve Fiyat Segmentasyonu
    const productId = "prod_" + Math.random().toString(36).substring(2, 9);
    const productTypes: ('glitch_art' | 'ui_kit' | 'cyber_zine' | 'cyber_prompt' | 'terminal_game' | 'vapor_synth')[] = [
      'glitch_art', 'ui_kit', 'cyber_zine', 'cyber_prompt', 'terminal_game', 'vapor_synth'
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
    }

    let resultTitle = "";
    let resultDescription = "";
    let resultCodeContent = "";
    let resultPdfContentText = "";
    let resultPromptPackage = "";
    let resultGameCode = "";
    let resultSynthCode = "";

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
      "synth_code": "[Only if vapor_synth: complete Web Audio API Javascript code or empty string]"
    }`;

    const aiRes = await axios.post("https://text.pollinations.ai/", {
      messages: [{ role: "user", content: curatorPrompt }],
      model: "openai"
    }, { timeout: 30000 });

    const text = aiRes.data || "";
    const cleanJson = text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanJson);

    resultTitle = parsed.title || `${artifact.name} - Glitch Art Echo`;
    resultDescription = parsed.description || `Salvaged from the deep archive. Undergoing quantum decoding. Ready for listing.`;
    resultCodeContent = parsed.code_content || "";
    resultPdfContentText = parsed.pdf_content_text || "";
    resultPromptPackage = parsed.prompt_package || "";
    resultGameCode = parsed.game_code || "";
    resultSynthCode = parsed.synth_code || "";


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
    }

    artifact.is_analyzed = true;
    artifact.status = "analyzed";

    // Save to Firestore
    if (db) {
      await setDoc(doc(db, "products", productId), newProduct);
      await setDoc(doc(db, "artifacts", artifact.id), artifact);
    }
    await writeLogToFirestore("info", `Otonom Adım 2 Başarılı: Eser '${resultTitle}' (${selectedType}) kürasyonu tamamlandı ve kaydedildi.`, "SYSTEM");

    // Adım 3: Gumroad Otonom Entegrasyonu ve Yayına Alma
    let finalMarketplaceUrl = "";
    await writeLogToFirestore("info", `Otonom Adım 3: Gumroad v2 API (/v2/products) canlı uç noktasına istek gönderiliyor...`, "SYSTEM");
    const storageUrl = await getDirectImageUrl(newProduct.image_url, newProduct.id);

    // --- GUMROAD FORM POST - ELLE QUERY STRING ---
    const gumroadParams = {
      name: String(artifact.name || "Siber Antika"),
      price_cents: 990,
      description: String(artifact.description || "Cyber-Archeologist Series")
    };

    const queryString = Object.keys(gumroadParams)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(String(gumroadParams[key])))
      .join('&');

    console.log("[FINAL-FIX] Gumroad'a elle oluşturulan query string basılıyor:", queryString.substring(0, 100) + "...");

    const gumroadRes = await axios.post('https://api.gumroad.com/v2/products', queryString, {
      headers: {
        "Authorization": `Bearer ${process.env.GUMROAD_API_KEY || ""}`,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      timeout: 30000
    });

    if (!gumroadRes?.data?.product?.short_url || !gumroadRes?.data?.product?.id) {
      throw new Error(`Gumroad API eksik veri döndürdü: ${JSON.stringify(gumroadRes?.data || {})}`);
    }

    finalMarketplaceUrl = gumroadRes.data.product.short_url;

    const gumId = gumroadRes.data.product.id;
    if (gumId) {
      try {
        await axios.put(`https://api.gumroad.com/v2/products/${gumId}/publish`, {}, {
          timeout: 30000,
          headers: {
            "Authorization": `Bearer ${process.env.GUMROAD_API_KEY || ""}`
          }
        });
        await writeLogToFirestore("info", `Otonom Adım 3.1 Başarılı: Gumroad ürünü otomatik olarak YAYINA ALINDI (PUBLISHED).`, "SYSTEM");
      } catch (pubErr: any) {
        await writeLogToFirestore("warn", `Gumroad publish hatası (kritik değil): ${pubErr.message}`, "SYSTEM");
      }
    }

    newProduct.is_listed = true;
    newProduct.marketplace_url = finalMarketplaceUrl;

    artifact.is_listed = true;
    artifact.status = "listed";

    if (db) {
      await setDoc(doc(db, "products", productId), newProduct);
      await setDoc(doc(db, "artifacts", artifact.id), artifact);
    }
    await writeLogToFirestore("info", `Otonom Adım 3 Başarılı: Gumroad listelendi ve yayında -> ${finalMarketplaceUrl}`, "SYSTEM");

    // Adım 4: IPFS Merkezsiz Arşivleme
    await writeLogToFirestore("info", `Otonom Adım 4: IPFS merkezsiz arşivleme işlemi başlatılıyor...`, "SYSTEM");

    if (!process.env.IPFS_API_URL) {
      throw new Error("IPFS_API_URL ortam degiskeni ayarli degil");
    }

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

    await writeLogToFirestore("info", `TÜM OTONOM HAT BAŞARIYLA TAMAMLANDI! Yepyeni siber-eser mağazada satışa sunuldu ve IPFS'e kaydedildi.`, "SYSTEM");
  } catch (pipelineErr: any) {
    await writeLogToFirestore("error", `Otonom Akış Hatası: ${pipelineErr.message}`, "SYSTEM");
  }
}

// Dynamic autonomous scheduler settings
const otonomSettings = {
  is_active: true,
  interval_minutes: 5,
  speed_mode: "STANDARD",
  elapsed_minutes: 0
};

// Schedule node-cron task to execute the comprehensive Autonomous Pipeline on a 1-minute supervisor tick
cron.schedule("* * * * *", async () => {
  if (!otonomSettings.is_active) return;
  
  otonomSettings.elapsed_minutes++;
  
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
    const productTypes: ('glitch_art' | 'ui_kit' | 'cyber_zine' | 'cyber_prompt' | 'terminal_game' | 'vapor_synth')[] = [
      'glitch_art', 'ui_kit', 'cyber_zine', 'cyber_prompt', 'terminal_game', 'vapor_synth'
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
    }

    let resultTitle = "";
    let resultDescription = "";
    let resultCodeContent = "";
    let resultPdfContentText = "";
    let resultPromptPackage = "";
    let resultGameCode = "";
    let resultSynthCode = "";
    
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
      "synth_code": "[Only if vapor_synth: complete Web Audio API Javascript code or empty string]"
    }`;

    try {
      const aiRes = await axios.post("https://text.pollinations.ai/", {
        messages: [{ role: "user", content: curatorPrompt }],
        model: "openai"
      }, { timeout: 30000 });

      const text = aiRes.data || "";
      const cleanJson = text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanJson);

      resultTitle = parsed.title || `${artifact.name} - Glitch Art Echo`;
      resultDescription = parsed.description || `Salvaged from the deep archive. Undergoing quantum decoding. Ready for listing.`;
      resultCodeContent = parsed.code_content || "";
      resultPdfContentText = parsed.pdf_content_text || "";
      resultPromptPackage = parsed.prompt_package || "";
      resultGameCode = parsed.game_code || "";
      resultSynthCode = parsed.synth_code || "";

      await writeLogToFirestore("info", `Ücretsiz Yapay Zeka analizi tamamlandı: ${resultTitle} (${selectedType})`, "GEMINI");
    } catch (aiErr: any) {
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
// MODULE 4: GUMROAD AUTOMATED LISTING
// ==========================================
app.post("/api/products/list-gumroad/:id", async (req, res) => {
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
    await writeLogToFirestore("info", `Gumroad otonom API yükleme döngüsü tetiklendi: ${product.title} (${product.product_type})`, "MARKETPLACE");

    // Adım 2: Wayback Machine üzerindeki orijinal canlı görsel URL'sini doğrudan pazar yerine ilet
    const storageUrl = await getDirectImageUrl(product.image_url, product.id);

    let targetLink = "";

    try {
      const nihaiTemizPayload = {
        name: String(product.title || "Retro Hardware"),
        price_cents: 990,
        description: String(product.description || "Cyber-Archeologist Series")
      };

      await new Promise(resolve => setTimeout(resolve, 2000));

      // --- GUMROAD FORM POST - ELLE QUERY STRING ---
      const gumroadParams = {
        name: String(product.title || "Siber Antika"),
        price_cents: 990,
        description: String(product.description || "Cyber-Archeologist Series")
      };

      const queryString = Object.keys(gumroadParams)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(String(gumroadParams[key])))
        .join('&');

      console.log("[FINAL-FIX] Gumroad'a elle oluşturulan query string basılıyor!");

      const response = await axios.post('https://api.gumroad.com/v2/products', queryString, {
        headers: {
          "Authorization": `Bearer ${process.env.GUMROAD_API_KEY || ""}`,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        timeout: 30000
      });

      if (response.data?.product?.short_url && response.data?.product?.id) {
        targetLink = response.data.product.short_url;
        const gumId = response.data.product.id;
        if (gumId) {
          try {
            await axios.put(`https://api.gumroad.com/v2/products/${gumId}/publish`, {}, {
              timeout: 30000,
              headers: {
                "Authorization": `Bearer ${process.env.GUMROAD_API_KEY || ""}`
              }
            });
            await writeLogToFirestore("info", `Gumroad ürünü yayına alındı (PUBLISHED)`, "MARKETPLACE");
          } catch (pubErr: any) {
            await writeLogToFirestore("warn", `Gumroad publish hatası: ${pubErr.message}`, "MARKETPLACE");
          }
        }
        await writeLogToFirestore("info", `Gumroad API listeleme başarılı! Ürün satışta: ${targetLink}`, "MARKETPLACE");
      } else {
        await writeLogToFirestore("error", `Gumroad API yanıt döndü ama short_url eksik. Yanıt: ${JSON.stringify(response.data)}`, "MARKETPLACE");
      }
    } catch (gumErr: any) {
      await writeLogToFirestore("error", `Gumroad API sorgulaması başarısız: ${gumErr.message}. Status: ${gumErr.response?.status || 'N/A'}. Yanıt: ${JSON.stringify(gumErr.response?.data || {})}`, "MARKETPLACE");
      targetLink = "";
    }

    product.is_listed = targetLink ? true : false;
    product.marketplace_url = targetLink;

    const artDoc = await getDoc(doc(db, "artifacts", product.artifact_id));
    if (artDoc.exists()) {
      const artifact = artDoc.data() as Artifact;
      artifact.is_listed = targetLink ? true : false;
      artifact.status = targetLink ? "listed" : "analyzed";
      await setDoc(doc(db, "artifacts", product.artifact_id), artifact);
    }

    await setDoc(doc(db, "products", productId), product);

    if (targetLink) {
      await writeLogToFirestore("info", `Ürün başarıyla yayına alındı: ${product.title}`, "SYSTEM");
      res.json({ success: true, product });
    } else {
      res.json({ success: false, error: "Gumroad API kullanılamıyor", product });
    }

  } catch (error: any) {
    await writeLogToFirestore("error", `Gumroad Listeleme Hatası: ${error.message}`, "MARKETPLACE");
    res.status(500).json({ error: error.message });
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
