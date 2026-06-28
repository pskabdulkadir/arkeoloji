import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Cpu,
  Link as LinkIcon,
  Search,
  CheckCircle,
  AlertTriangle,
  Terminal,
  ShoppingBag,
  Send,
  Share,
  RefreshCw,
  Layers,
  Database,
  Globe,
  Trash2,
  Tag,
  Info,
  DollarSign,
  Lock,
  Eye,
  EyeOff,
  Clock,
  TrendingUp,
  Sliders,
  Check,
  Power,
  Volume2,
  ShieldAlert,
  Activity,
  Zap
} from "lucide-react";
import { Artifact, Product, SystemLog, SystemStatus } from "./types";

export default function App() {
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Core App states
  const [status, setStatus] = useState<SystemStatus>({
    firebase_connected: false,
    is_fallback: true,
    gemini_configured: false,
    gumroad_configured: false,
    ipfs_node_active: false
  });

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  // Form / Digger states
  const [selectedPreset, setSelectedPreset] = useState<string>("geocities.com/siliconvalley");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [isDigging, setIsDigging] = useState<boolean>(false);
  
  // Selection states
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isListingId, setIsListingId] = useState<string | null>(null);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);


  // Interactive product preview states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [synthPlayingId, setSynthPlayingId] = useState<string | null>(null);
  const audioIntervalRef = useRef<any>(null);

  const toggleVaporSynth = (productId: string, synthCode?: string) => {
    if (synthPlayingId === productId) {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
      setSynthPlayingId(null);
      return;
    }

    setSynthPlayingId(productId);
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
      let step = 0;

      const playTone = (freq: number, duration: number, type: 'sine' | 'sawtooth' | 'triangle' | 'square') => {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      };

      const interval = setInterval(() => {
        const f = scale[step % scale.length];
        playTone(f, 0.4, step % 2 === 0 ? 'sawtooth' : 'triangle');
        step++;
      }, 400);

      audioIntervalRef.current = interval;
    } catch (e) {
      console.error("Audio synth error", e);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Log filtering
  const [logFilter, setLogFilter] = useState<string>("ALL");
  const [terminalAutoScroll, setTerminalAutoScroll] = useState<boolean>(false);
  
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);

  // Real earnings from listed products
  const [totalEarnings, setTotalEarnings] = useState<number>(0);

  // Otonom Control State
  const [otonomSettings, setOtonomSettings] = useState<{
    is_active: boolean;
    interval_minutes: number;
    speed_mode: string;
  }>({
    is_active: true,
    interval_minutes: 5,
    speed_mode: "STANDARD"
  });


  const handleToggleOtonom = async () => {
    try {
      const nextActive = !otonomSettings.is_active;
      const res = await fetch("/api/settings/otonom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...otonomSettings, is_active: nextActive })
      });
      if (res.ok) {
        const data = await res.json();
        setOtonomSettings(data.settings);
        await fetchData();
      }
    } catch (err) {
      console.error("Error toggling otonom settings:", err);
    }
  };

  const handleChangeInterval = async (minutes: number, speedMode: string) => {
    try {
      const res = await fetch("/api/settings/otonom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...otonomSettings, interval_minutes: minutes, speed_mode: speedMode })
      });
      if (res.ok) {
        const data = await res.json();
        setOtonomSettings(data.settings);
        await fetchData();
      }
    } catch (err) {
      console.error("Error changing otonom interval:", err);
    }
  };

  const handleTriggerOtonomNow = async () => {
    try {
      const res = await fetch("/api/otonom/trigger", { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Error triggering otonom now:", err);
    }
  };

  const [purchaseSuccessId, setPurchaseSuccessId] = useState<string | null>(null);

  const handleSimulatePurchase = async (productId: string) => {
    try {
      const res = await fetch(`/api/products/simulate-purchase/${productId}`, {
        method: "POST"
      });
      if (res.ok) {
        playCheckoutSound();
        setPurchaseSuccessId(productId);
        setTimeout(() => setPurchaseSuccessId(null), 4000);
        await fetchData();
      }
    } catch (err) {
      console.error("Simulation purchase error:", err);
    }
  };

  const playCheckoutSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      
      const playChime = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0.35, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = audioCtx.currentTime;
      playChime(523.25, now, 0.15); // C5
      playChime(659.25, now + 0.12, 0.2); // E5
      playChime(783.99, now + 0.24, 0.4); // G5
    } catch (err) {
      console.error("Audio playback failure", err);
    }
  };

  // Fetch initial data & set interval
  const fetchData = async () => {
    try {
      const statusRes = await fetch("/api/status");
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
      }

      const settingsRes = await fetch("/api/settings/otonom");
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setOtonomSettings(data);
      }

      const artRes = await fetch("/api/artifacts");
      if (artRes.ok) {
        const data = await artRes.json();
        setArtifacts(data);
        if (data.length > 0 && !activeArtifactId) {
          setActiveArtifactId(data[0].id);
        }
      }

      const prodRes = await fetch("/api/products");
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data);
        
        // Calculate actual earnings from listed products based on sales_count
        const baseListedEarnings = data
          .filter((p: Product) => p.is_listed)
          .reduce((sum: number, p: Product) => sum + (p.price * (p.sales_count || 0)), 0);
        setTotalEarnings(parseFloat(baseListedEarnings.toFixed(2)));
      }

      const logsRes = await fetch("/api/logs");
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Veri çekme hatası:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetch("/api/logs")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setLogs(data);
          // Scroll only the terminal container internally, preserving parent scroll positions
          if (terminalAutoScroll && terminalContainerRef.current) {
            terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
          }
        });
    }, 3000);
    return () => clearInterval(interval);
  }, [terminalAutoScroll]);

  // Auth Handler (Firebase Auth Ready Fallback)
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError("Lütfen tüm alanları doldurun.");
      return;
    }
    // Validate custom credentials or fallback
    if (
      (email === "psikologabdulkadirkan@gmail.com" && password === "Abdulkadir1983") ||
      password === "cyberarch2026"
    ) {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Geçersiz kimlik bilgileri veya siber-parola!");
    }
  };

  // Module 2 Manual Trigger: Scrape Wayback Machine
  const handleWaybackScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDigging(true);
    try {
      const res = await fetch("/api/artifacts/dig-wayback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customUrl: customUrl || selectedPreset })
      });
      if (res.ok) {
        const result = await res.json();
        setCustomUrl("");
        await fetchData();
        if (result.artifact) {
          setActiveArtifactId(result.artifact.id);
        }
      }
    } catch (err) {
      console.error("Wayback scraping error:", err);
    } finally {
      setIsDigging(false);
    }
  };

  // Module 3 Manual Trigger: Gemini Curation
  const handleGeminiCuration = async (id: string) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/artifacts/curate-gemini/${id}`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Gemini curation error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Module 4: Gumroad upload (FULLY AUTONOMOUS - trigger pipeline)
  const handleGumroadUpload = async (productId: string) => {
    setIsListingId(productId);
    try {
      const res = await fetch("/api/otonom/trigger", { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Error triggering pipeline:", err);
    } finally {
      setIsListingId(null);
    }
  };

  // Module 5 Manual Trigger: Decentralized IPFS Archiving
  const handleIpfsArchive = async (productId: string) => {
    setIsArchivingId(productId);
    try {
      const res = await fetch(`/api/products/ipfs-archive/${productId}`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("IPFS archiving error:", err);
    } finally {
      setIsArchivingId(null);
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    try {
      const res = await fetch("/api/logs/clear", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Logs clear error:", err);
    }
  };

  const selectedArtifact = artifacts.find((a) => a.id === activeArtifactId);
  const correspondingProduct = products.find((p) => p.artifact_id === activeArtifactId);

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (logFilter === "ALL") return true;
    return l.module === logFilter;
  });

  // Calculate some cool KPI numbers
  const totalArtifacts = artifacts.length;
  const totalProducts = products.length;
  const listedCount = products.filter(p => p.is_listed).length;
  const sharedCount = products.filter(p => p.is_archived).length;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#060813] text-gray-100 flex flex-col justify-between font-sans selection:bg-cyan-500 selection:text-slate-950 relative overflow-hidden">
        
        {/* Holographic background graphics */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#0c1938,transparent_50%)] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c0e1a_1px,transparent_1px),linear-gradient(to_bottom,#0c0e1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>

        {/* TOP MINI LOGO */}
        <header className="p-6">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg">
              <Cpu className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <span className="font-mono font-bold tracking-widest text-[11px] text-cyan-400">ARCHAEOLOGY SYSTEMS</span>
              <h2 className="text-sm font-bold text-slate-300">OTONOM SİBER-TAKİP KONTROL ARABİRİMİ</h2>
            </div>
          </div>
        </header>

        {/* LOGIN CARD */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0b0f1e]/90 border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl relative">
            {/* Glowing borders */}
            <div className="absolute -inset-px bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 rounded-2xl -z-10 blur-[2px]"></div>

            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center text-white shadow-xl shadow-cyan-500/10">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Otonom Arkeoloji Giriş</h1>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                Wayback Machine Scraping, Gemini 2.5 Art Curation & Gumroad 7/24 listeleme yönetim paneline güvenli erişim sağlayın.
              </p>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/35 p-3 rounded-xl mb-5 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-300">{authError}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono tracking-widest text-gray-400 uppercase mb-1.5">Kullanıcı E-Posta</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e-posta adresiniz"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mb-1.5">
                  <label className="block text-[11px] font-mono tracking-widest text-gray-400 uppercase">Siber Parola / Passcode</label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition duration-150 shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2"
              >
                Giriş Yap ve Terminali Aç
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800/60 pt-4 text-center">
              <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-500/5 border border-cyan-500/10 px-2.5 py-1 rounded-full">
                Firebase Authentication Fallback Modu Aktif
              </span>
            </div>
          </div>
        </main>

        {/* BOTTOM LEGAL */}
        <footer className="p-6 text-center text-xs text-gray-600 font-mono">
          © 2026 Siber Arkeoloji Otonom Giriş Portu. Tüm hakları saklıdır.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070914] text-gray-100 flex flex-col justify-between font-sans selection:bg-cyan-500 selection:text-slate-950 relative overflow-x-hidden">
      
      {/* Background Matrix Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c0e1a_1px,transparent_1px),linear-gradient(to_bottom,#0c0e1a_1px,transparent_1px)] bg-[size:5rem_5rem] opacity-20 pointer-events-none"></div>

      {/* HEADER HUD */}
      <header className="border-b border-slate-800/80 bg-[#0c1020]/90 backdrop-blur sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-500 to-purple-600 rounded-xl text-white shadow-lg shadow-cyan-500/15 animate-pulse">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-400">WAYBACK ARCHEOLOGY SCRA-BOT</span>
                <span className="text-[10px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/35 px-1.5 py-0.2 rounded font-mono font-bold">ACTIVE DEPLOY</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Otonom Dijital Küratörlük Terminali</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3.5">
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 hover:border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Verileri Çek
            </button>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-xs text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-1.5 transition font-mono"
            >
              Kanalı Kapat
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">

        {/* STATUS HUD PANEL */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="stats-hud">
          <div className="bg-[#0b0e1a] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden group hover:border-cyan-500/30 transition">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">KAZILAN ANTİKA</span>
              <p className="text-2xl font-bold text-white font-mono">{totalArtifacts}</p>
              <span className="text-[10px] text-cyan-400/80 font-mono block">Wayback Database</span>
            </div>
            <div className="p-3 bg-cyan-500/5 text-cyan-400 rounded-xl group-hover:bg-cyan-500/10 transition">
              <Search className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-[#0b0e1a] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden group hover:border-purple-500/30 transition">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">SANAT KÜRASYONU</span>
              <p className="text-2xl font-bold text-white font-mono">{totalProducts}</p>
              <span className="text-[10px] text-purple-400/80 font-mono block">Gemini Multimodal</span>
            </div>
            <div className="p-3 bg-purple-500/5 text-purple-400 rounded-xl group-hover:bg-purple-500/10 transition">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-[#0b0e1a] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden group hover:border-emerald-500/30 transition">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">SATILAN / LİSTELENEN</span>
              <p className="text-2xl font-bold text-white font-mono">{listedCount}</p>
              <span className="text-[10px] text-emerald-400/80 font-mono block">Gumroad / Shopify</span>
            </div>
            <div className="p-3 bg-emerald-500/5 text-emerald-400 rounded-xl group-hover:bg-emerald-500/10 transition">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-[#0b0e1a] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden group hover:border-amber-500/30 transition">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">TOPLAM SİBER GELİR</span>
              <p className="text-2xl font-bold text-amber-400 font-mono">${totalEarnings.toFixed(2)}</p>
              <span className="text-[10px] text-amber-500/80 font-mono block">Otonom Satış Hacmi</span>
            </div>
            <div className="p-3 bg-amber-500/5 text-amber-400 rounded-xl group-hover:bg-amber-500/10 transition">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* INTERACTIVE ACTIONS & PROCESS TRACKER */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COL 1: WAYBACK MACHINE SCRAPER CONTROLS */}
          <div className="bg-[#0b0f1e]/90 border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 bg-[#11162b] border-b border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400" />
                <h2 className="font-bold text-sm tracking-wide text-white uppercase">AŞAMA 1: SİBER ÇÖP KAZICI (WAYBACK)</h2>
              </div>
              <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20">MODULE 2</span>
            </div>

            <div className="p-4 border-b border-slate-800/40 bg-slate-950/20">
              <form onSubmit={handleWaybackScrape} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono tracking-widest text-slate-400 uppercase mb-2">Hedef Antik Web Arşivi Seçin</label>
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="geocities.com/siliconvalley">Geocities Silicon Valley (1998)</option>
                    <option value="angelfire.com/scifi/matrix">Angelfire Cyber Matrix Archive (1999)</option>
                    <option value="tripod.com/retro_hacker">Tripod Nostalgic Hacker Portal (2000)</option>
                    <option value="spacejam.com/1996">SpaceJam Classic Warner Archive (1996)</option>
                    <option value="amiga.org/vintage_graphics">Amiga Vintage Computer Museum (1997)</option>
                    <option value="mp3.com/vintage_vapor">MP3.com Vapor Ambient Nodes (2001)</option>
                    <option value="slashdot.org/y2k_bug">Slashdot Y2K Bug Log Portal (2000)</option>
                    <option value="napster.com/decrypted_meta">Napster Decrypted Peer-to-Peer Hub (1999)</option>
                    <option value="cyberpunk2020.com/netrun">Cyberpunk 2020 Netrun Database (2002)</option>
                    <option value="retro-nasa.gov/apollo_telemetry">Retro NASA Apollo Space Telemetry (1996)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-widest text-slate-400 uppercase mb-2">Veya Özel URL Girin</label>
                  <div className="relative">
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://vintage-computer.org"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-9 pr-3 py-2 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                    <LinkIcon className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isDigging}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-md shadow-cyan-500/5 flex items-center justify-center gap-2"
                >
                  {isDigging ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Arşivden Bozuk Grafik Çekiliyor...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      Wayback Scraper Tetikle
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* OTONOM BOT KONTROL MERKEZİ */}
            <div className="p-4 border-b border-slate-800/40 bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-bold">OTONOM BORU HATTI</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleOtonom}
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border transition-all ${
                      otonomSettings.is_active
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                    }`}
                  >
                    {otonomSettings.is_active ? "● AKTİF" : "○ DURDURULDU"}
                  </button>
                  <button
                    onClick={handleTriggerOtonomNow}
                    title="Hemen yeni otonom kazı ve listeleme başlat"
                    className="p-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/20 transition-all"
                  >
                    <Zap className="w-3 h-3 animate-pulse" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleChangeInterval(1, "FAST")}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    otonomSettings.interval_minutes === 1
                      ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-400"
                      : "bg-slate-950/60 border-slate-800/40 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <div className="text-[9px] font-mono font-bold">HIZLI</div>
                  <div className="text-[8px] font-mono text-slate-500 mt-0.5">1 Dakika</div>
                </button>

                <button
                  onClick={() => handleChangeInterval(5, "STANDARD")}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    otonomSettings.interval_minutes === 5
                      ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-400"
                      : "bg-slate-950/60 border-slate-800/40 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <div className="text-[9px] font-mono font-bold">STANDART</div>
                  <div className="text-[8px] font-mono text-slate-500 mt-0.5">5 Dakika</div>
                </button>

                <button
                  onClick={() => handleChangeInterval(60, "SLOW")}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    otonomSettings.interval_minutes === 60
                      ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-400"
                      : "bg-slate-950/60 border-slate-800/40 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <div className="text-[9px] font-mono font-bold">YAVAŞ</div>
                  <div className="text-[8px] font-mono text-slate-500 mt-0.5">60 Dakika</div>
                </button>
              </div>
            </div>

            {/* Scrolling artifacts list */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[290px]">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800/40">
                <span className="font-mono uppercase tracking-widest text-[10px]">KAZILAN KÜLTÜREL ARTIFAKTLAR</span>
                <span className="bg-slate-950 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-800/80">{artifacts.length}</span>
              </div>

              {artifacts.length === 0 ? (
                <div className="text-center py-10">
                  <Globe className="w-8 h-8 text-slate-700 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-gray-500">Kayıtlı kalıntı bulunamadı. Digger botu tetikleyin.</p>
                </div>
              ) : (
                artifacts.map((art) => (
                  <button
                    key={art.id}
                    onClick={() => setActiveArtifactId(art.id)}
                    className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-2 ${
                      activeArtifactId === art.id
                        ? "bg-[#131a38] border-cyan-500/60 shadow-lg shadow-cyan-500/5"
                        : "bg-slate-950/60 border-slate-800/50 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono border ${
                        art.status === "listed"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : art.status === "analyzed"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        {art.status === "listed" ? "MAĞAZADA" : art.status === "analyzed" ? "KÜRASYONDA" : "ANALİZ BEKLEYEN"}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {new Date(art.extracted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white line-clamp-1">{art.name}</h4>
                    
                    <div className="flex items-center justify-between text-[11px] border-t border-slate-800/30 pt-2 text-slate-400">
                      <span className="truncate max-w-[140px] font-mono text-[10px] text-slate-500">{art.source_url}</span>
                      <span className="text-cyan-400 font-mono font-bold">%{Math.round(art.confidence * 100)} İtimat</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* COL 2: GEMINI MULTIMODAL CURATION CENTER */}
          <div className="bg-[#0b0f1e]/90 border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 bg-[#11162b] border-b border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h2 className="font-bold text-sm tracking-wide text-white uppercase">AŞAMA 2: GEMINI 2.5 SANAT KÜRASYONU</h2>
              </div>
              <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">MODULE 3</span>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between">
              {selectedArtifact ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="bg-slate-950/80 border border-slate-800/85 p-3 rounded-xl space-y-2.5 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-widest">KAZILAN HAM DİJİTAL ATIK</span>
                      <span className="text-[10px] text-slate-500 font-mono">ID: {selectedArtifact.id}</span>
                    </div>
                    
                    <div className="flex items-start gap-2.5">
                      {selectedArtifact.image_url && (
                        <img
                          src={selectedArtifact.image_url}
                          alt="Relic"
                          className="w-12 h-12 rounded object-cover border border-slate-800"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-white">{selectedArtifact.name}</h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{selectedArtifact.source_url}</p>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2 rounded border border-slate-900/80 text-[10px] font-mono text-cyan-500/90 h-[100px] overflow-y-auto whitespace-pre-wrap leading-relaxed select-text scrollbar-thin">
                      {selectedArtifact.raw_content}
                    </div>
                  </div>

                  {selectedArtifact.status === "pending" ? (
                    <div className="bg-purple-950/10 border border-dashed border-purple-500/30 p-4 rounded-xl text-center space-y-3 flex-1 flex flex-col items-center justify-center">
                      <Sparkles className="w-9 h-9 text-purple-400 animate-pulse" />
                      <div>
                        <h4 className="text-xs font-bold text-white">Siber-Sanat Çevirisini Başlat</h4>
                        <p className="text-[10px] text-slate-400 max-w-[210px] mx-auto mt-1 leading-relaxed">
                          Gemini Multimodal modeli, görsel hasar piksellerini felsefi siber-punk sanata çevirerek başlık, 3 paragraflık açıklama ve fiyat atayacaktır.
                        </p>
                      </div>
                      
                      <button
                        onClick={() => handleGeminiCuration(selectedArtifact.id)}
                        disabled={isAnalyzing}
                        className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-purple-500/5"
                      >
                        {isAnalyzing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Gemini 2.5 Flash Analiz Ediyor...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Gemini Multimodal Kürasyon Yap
                          </>
                        )}
                      </button>
                    </div>
                  ) : correspondingProduct ? (
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[290px] pr-1">
                      <div className="border border-slate-800/80 bg-slate-950/60 rounded-xl overflow-hidden flex flex-col">
                        <div className="relative aspect-video w-full bg-slate-900">
                          <img
                            src={correspondingProduct.image_url}
                            alt={correspondingProduct.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 right-2 bg-slate-950/85 text-amber-400 border border-slate-800/60 font-mono font-bold text-xs px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {correspondingProduct.price.toFixed(2)}
                          </div>
                        </div>

                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono tracking-widest text-purple-400 uppercase">GEMINI KÜLTÜREL DÖNÜŞÜM</span>
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-mono">STATUS: OK</span>
                          </div>

                          <h4 className="text-xs font-bold text-white">{correspondingProduct.title}</h4>
                          
                          <div className="text-[11px] text-slate-300 leading-relaxed space-y-2 max-h-[140px] overflow-y-auto scrollbar-thin select-text pr-1.5">
                            {correspondingProduct.description.split('\n\n').map((para, idx) => (
                              <p key={idx}>{para}</p>
                            ))}
                          </div>

                          {/* INTERACTIVE ASSET DELIVERABLE PREVIEW */}
                          <div className="border-t border-slate-800/60 pt-2.5 mt-2 space-y-2">
                            <span className="text-[9px] font-mono tracking-wider text-cyan-400 block uppercase">
                              DİJİTAL TESLİMAT ÖNİZLEME & ETKİLEŞİM
                            </span>

                            {correspondingProduct.product_type === "ui_kit" && (
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-900 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-mono text-slate-500">Tailwind CSS Component Code</span>
                                  <button
                                    onClick={() => handleCopyText((correspondingProduct as any).code_content || "", correspondingProduct.id)}
                                    className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/50"
                                  >
                                    {copiedId === correspondingProduct.id ? "Kopyalandı!" : "Kodu Kopyala"}
                                  </button>
                                </div>
                                <pre className="text-[9px] font-mono text-green-400 max-h-[80px] overflow-y-auto scrollbar-thin whitespace-pre select-text bg-black/50 p-1.5 rounded">
                                  {(correspondingProduct as any).code_content || "<!-- No code available -->"}
                                </pre>
                              </div>
                            )}

                            {correspondingProduct.product_type === "cyber_prompt" && (
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-900 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-mono text-slate-500">Premium AI Prompt Package</span>
                                  <button
                                    onClick={() => handleCopyText((correspondingProduct as any).prompt_package || "", correspondingProduct.id)}
                                    className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/50"
                                  >
                                    {copiedId === correspondingProduct.id ? "Kopyalandı!" : "Promptları Kopyala"}
                                  </button>
                                </div>
                                <div className="text-[10px] font-mono text-amber-400 max-h-[80px] overflow-y-auto scrollbar-thin whitespace-pre-wrap select-text bg-black/50 p-1.5 rounded leading-relaxed">
                                  {(correspondingProduct as any).prompt_package || "No prompt details."}
                                </div>
                              </div>
                            )}

                            {correspondingProduct.product_type === "terminal_game" && (
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-900 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-mono text-slate-500">Interactive Terminal Game Module</span>
                                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 rounded">SANDBOX READY</span>
                                </div>
                                <div className="bg-black p-2 rounded text-[10px] font-mono border border-emerald-500/20 text-emerald-500 space-y-1.5">
                                  <p className="text-white font-bold border-b border-emerald-500/20 pb-1">DECRYPTOR SHELL v1.4</p>
                                  <p className="text-[9px]">Run game in any modern browser by double-clicking the listed file.</p>
                                  <button 
                                    onClick={() => alert("Oyun kodunu indirmek veya doğrudan çalıştırmak için listelenen dosyayı alabilirsiniz!")}
                                    className="w-full text-center py-1 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800 text-emerald-300 rounded text-[9px] transition"
                                  >
                                    Terminal Test Çalıştır
                                  </button>
                                </div>
                              </div>
                            )}

                            {correspondingProduct.product_type === "vapor_synth" && (
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-900 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-mono text-slate-500">Retro Audio Synth Code</span>
                                  <button
                                    onClick={() => handleCopyText((correspondingProduct as any).synth_code || "", correspondingProduct.id)}
                                    className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/50"
                                  >
                                    {copiedId === correspondingProduct.id ? "Kopyalandı!" : "Sentezleyici Kodunu Al"}
                                  </button>
                                </div>
                                <div className="bg-gradient-to-r from-purple-950/20 to-pink-950/20 p-2.5 rounded-lg border border-purple-500/15 flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] font-mono text-purple-300 uppercase block">VAPORWAVE AMBIENT DRONE</span>
                                    <span className="text-[10px] text-slate-400">Web Audio API synth loop</span>
                                  </div>
                                  <button
                                    onClick={() => toggleVaporSynth(correspondingProduct.id, (correspondingProduct as any).synth_code)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-mono font-bold transition flex items-center gap-1 ${
                                      synthPlayingId === correspondingProduct.id
                                        ? "bg-red-500 text-white animate-pulse"
                                        : "bg-purple-600 hover:bg-purple-500 text-white"
                                    }`}
                                  >
                                    <Volume2 className="w-3 h-3" />
                                    {synthPlayingId === correspondingProduct.id ? "Durdur" : "Test Sesi Oynat"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {correspondingProduct.product_type === "cyber_zine" && (
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-900 space-y-1">
                                <span className="text-[9px] font-mono text-slate-500">Zine Publication Structure</span>
                                <p className="text-[10px] text-purple-400 font-mono">✓ High fidelity PDF generation ready</p>
                                <p className="text-[9px] text-slate-400">Zine format integrates neon black backings with authentic monospace typography layout.</p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-800/40">
                            {correspondingProduct.tags.map((tag, idx) => (
                              <span key={idx} className="text-[9px] bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-slate-400 flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5 text-purple-500" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <AlertTriangle className="w-8 h-8 text-amber-400 mb-2 animate-pulse" />
                      <p className="text-xs text-slate-500">Kürasyon tamamlandı ancak ürün bulunamadı. Lütfen yenileyin.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                  <Sliders className="w-10 h-10 text-slate-800 mb-3" />
                  <p className="text-xs text-slate-400 font-bold mb-1">Eser Seçilmedi</p>
                  <p className="text-[11px] text-slate-500 max-w-[210px] leading-relaxed">
                    Sol kısımdaki listeden kazılmış olan bir antika dökümanı seçerek otonom siber-sanat dönüştürücüsünü tetikleyebilirsiniz.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* COL 3: GUMROAD LISTING & TWITTER ADVERTISING */}
          <div className="bg-[#0b0f1e]/90 border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 bg-[#11162b] border-b border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <h2 className="font-bold text-sm tracking-wide text-white uppercase">AŞAMA 3: LİSTELEME & SOSYAL REKLAM</h2>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">MODULE 4-5</span>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between">
              {correspondingProduct ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="bg-slate-950/80 border border-slate-800/85 p-3 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">ENTEGRASYON KANALLARI</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">YAYINA HAZIR</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-slate-850 text-xs">
                        <span className="text-slate-300 font-medium">Gumroad / Shopify API</span>
                        {correspondingProduct.is_listed ? (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                            <Check className="w-3 h-3" /> Listelendi
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-850 text-slate-400 px-2 py-0.5 rounded-full font-mono">Bekliyor</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-slate-850 text-xs">
                        <span className="text-slate-300 font-medium">IPFS Merkezsiz Arşivleme</span>
                        {correspondingProduct.is_archived ? (
                          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                            <Check className="w-3 h-3" /> Arşivlendi
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-850 text-slate-400 px-2 py-0.5 rounded-full font-mono">Bekliyor</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Operational controls */}
                  <div className="space-y-3 flex-1 flex flex-col justify-end">
                    
                    {/* Trigger 1: List on Gumroad */}
                    <button
                      onClick={() => handleGumroadUpload(correspondingProduct.id)}
                      disabled={correspondingProduct.is_listed || isListingId !== null}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                        correspondingProduct.is_listed
                          ? "bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/5"
                      }`}
                    >
                      {isListingId === correspondingProduct.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Gumroad API ile Listeleniyor...
                        </>
                      ) : correspondingProduct.is_listed ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          Gumroad Mağazasında Satışta!
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          Gumroad Otonom Listelemeyi Başlat
                        </>
                      )}
                    </button>

                    {/* Trigger 2: IPFS Archiving */}
                    <button
                      onClick={() => handleIpfsArchive(correspondingProduct.id)}
                      disabled={!correspondingProduct.is_listed || correspondingProduct.is_archived || isArchivingId !== null}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                        !correspondingProduct.is_listed
                          ? "bg-slate-950 border border-slate-900 text-slate-600 cursor-not-allowed"
                          : correspondingProduct.is_archived
                          ? "bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/5"
                      }`}
                    >
                      {isArchivingId === correspondingProduct.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          IPFS Üzerine Kaydediliyor...
                        </>
                      ) : correspondingProduct.is_archived ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          IPFS Arşivlendi (CID Aktif)
                        </>
                      ) : (
                        <>
                          <Share className="w-3.5 h-3.5" />
                          IPFS Merkezsiz Arşive Gönder
                        </>
                      )}
                    </button>

                    {correspondingProduct.is_listed && correspondingProduct.marketplace_url && (
                      <div className="pt-2 border-t border-slate-850 space-y-2">
                        {correspondingProduct.marketplace_url.startsWith("simulation-checkout:") ? (
                          <div className="space-y-2">
                            <button
                              onClick={() => handleSimulatePurchase(correspondingProduct.id)}
                              className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition font-mono shadow-md shadow-emerald-500/10 cursor-pointer animate-pulse"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              SİMÜLE SATIN ALMA YAP (CHECKOUT DEMO)
                            </button>
                            {purchaseSuccessId === correspondingProduct.id && (
                              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] rounded-xl font-mono space-y-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <Check className="w-4 h-4 text-emerald-400" />
                                  SATIN ALMA TAMAMLANDI
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                  Demo satın alma başarılı! Kasaya ${correspondingProduct.price.toFixed(2)} eklendi ve akan log terminaline işlendi.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <a
                            href={correspondingProduct.marketplace_url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-cyan-400 hover:text-cyan-300 text-xs font-bold rounded-xl transition font-mono"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                            GUMROAD CANLI SATIŞ BAĞLANTISI
                          </a>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                  <ShoppingBag className="w-10 h-10 text-slate-800 mb-3" />
                  <p className="text-xs text-slate-400 font-bold mb-1">Satışa Hazır Ürün Yok</p>
                  <p className="text-[11px] text-slate-500 max-w-[210px] leading-relaxed">
                    Seçili arkeolojik eseri siber-sanata dönüştürmek için önce Aşama 2'yi (Gemini Küratörlüğü) çalıştırmalısınız.
                  </p>
                </div>
              )}
            </div>
          </div>

        </section>

        {/* LOG SYSTEM (CANLI TERMİNAL / LOG İZLEME) */}
        <section className="bg-[#0b0f1e]/90 border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
          
          <div className="p-4 bg-[#11162b] border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" />
              <h2 className="font-bold text-sm tracking-wide text-white uppercase flex items-center gap-2">
                OTONOM SİBER-TAKİP AKAN LOG TERMİNALİ
                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.2 rounded font-mono font-bold uppercase animate-pulse">● CANLI YAYIN (onSnapshot)</span>
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850">
                {["ALL", "SYSTEM", "DIGGER", "GEMINI", "MARKETPLACE", "IPFS"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setLogFilter(m)}
                    className={`px-2 py-0.5 text-[9px] font-mono rounded-md transition ${
                      logFilter === m
                        ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTerminalAutoScroll(!terminalAutoScroll)}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition flex items-center gap-1 ${
                    terminalAutoScroll 
                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" 
                      : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300"
                  }`}
                  title="Yeni log geldikçe otomatik aşağı kaydır"
                >
                  <Clock className="w-3 h-3" />
                  {terminalAutoScroll ? "Oto-Kayıdır" : "Sabit"}
                </button>

                <button
                  onClick={handleClearLogs}
                  className="p-1 px-2.5 bg-slate-950 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-slate-700 rounded-lg text-[10px] font-mono flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3 h-3" />
                  Temizle
                </button>
              </div>
            </div>
          </div>

          <div ref={terminalContainerRef} className="p-4 bg-slate-950/90 font-mono text-xs h-[190px] overflow-y-auto space-y-1.5 scrollbar-thin select-text">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-600 italic py-4">Terminal filtresine uyan otonom bot günlüğü bulunmuyor.</div>
            ) : (
              filteredLogs.map((log) => {
                let badgeColor = "bg-slate-800 text-gray-400 border-slate-700/50";
                if (log.level === "warn") badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                if (log.level === "error") badgeColor = "bg-red-500/10 text-red-400 border-red-500/20";
                if (log.level === "info") {
                  if (log.module === "DIGGER") badgeColor = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
                  else if (log.module === "GEMINI") badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                  else if (log.module === "MARKETPLACE") badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                  else if (log.module === "IPFS") badgeColor = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
                  else badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                }

                return (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed py-0.5 hover:bg-slate-900/30 rounded transition">
                    <span className="text-slate-600 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={`text-[9px] px-2 py-0.2 rounded border font-mono font-bold select-none tracking-wide ${badgeColor}`}>
                      {log.module}
                    </span>
                    <span className={`flex-1 ${log.level === "error" ? "text-red-400 font-bold" : log.level === "warn" ? "text-amber-400" : "text-slate-300"}`}>
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </section>

      </main>

      <footer className="border-t border-slate-900 bg-[#070a14] py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
          <p>© 2026 Siber-Arkeoloji Otonom Satış Botu Projesi. Tüm hakları saklıdır.</p>
          <p className="font-mono text-[11px] text-slate-600 flex items-center gap-1">
            <Database className="w-3.5 h-3.5" />
            Vite + React + Node.js (Express) ve Firebase Hazır Altyapı
          </p>
        </div>
      </footer>
    </div>
  );
}
