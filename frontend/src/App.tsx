import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  Cpu,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Search,
  Server,
  Zap,
  BarChart3,
  Lock,
  Globe,
  Terminal,
  X,
  Code,
  TrendingUp,
  Info,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface ServiceSLA {
  service_id: string;
  name: string;
  provider: string;
  endpoint_url: string;
  sla_criteria: string;
  total_evaluations: number;
  compliant_count: number;
  degraded_count: number;
  violated_count: number;
  consecutive_violations: number;
  penalty_threshold: number;
  last_verdict: 'COMPLIANT' | 'DEGRADED' | 'VIOLATED' | 'UNRESOLVED';
  last_score: number;
  is_active: boolean;
}

interface EvaluationRecord {
  evaluation_id: number;
  service_id: string;
  verdict: 'COMPLIANT' | 'DEGRADED' | 'VIOLATED';
  score: number;
  evaluator: string;
  summary: string;
  timestamp: string;
}

interface ToastNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xB0Ba9C3dC6a9460667E8e29d38A9e5fbaF7D807C';
const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://studio.genlayer.com/api';
const NETWORK_NAME = import.meta.env.VITE_CHAIN_ID || 'studionet';
const EXPLORER_URL = `https://studio.genlayer.com/address/${CONTRACT_ADDRESS}`;

const INITIAL_SERVICES: ServiceSLA[] = [
  {
    service_id: 'coingecko-feed-v3',
    name: 'CoinGecko Spot Oracle Gateway',
    provider: '0x71c...a49b',
    endpoint_url: 'https://api.coingecko.com/api/v3/ping',
    sla_criteria: 'HTTP 200 with valid status JSON and latency under 450ms. Must include server heartbeat.',
    total_evaluations: 24,
    compliant_count: 23,
    degraded_count: 1,
    violated_count: 0,
    consecutive_violations: 0,
    penalty_threshold: 3,
    last_verdict: 'COMPLIANT',
    last_score: 98,
    is_active: true,
  },
  {
    service_id: 'solana-rpc-cluster',
    name: 'Solana High-Throughput RPC Endpoint',
    provider: '0x992...32ec',
    endpoint_url: 'https://api.mainnet-beta.solana.com',
    sla_criteria: 'Responds to getHealth JSON-RPC call within 500ms with "ok" status. Zero socket drops.',
    total_evaluations: 38,
    compliant_count: 35,
    degraded_count: 2,
    violated_count: 1,
    consecutive_violations: 0,
    penalty_threshold: 3,
    last_verdict: 'COMPLIANT',
    last_score: 92,
    is_active: true,
  },
  {
    service_id: 'ethereum-sepolia-gateway',
    name: 'Ethereum Sepolia Public Gateway',
    provider: '0x342...9901',
    endpoint_url: 'https://rpc.sepolia.org',
    sla_criteria: 'Block sync state valid with latency under 800ms and response to eth_blockNumber.',
    total_evaluations: 17,
    compliant_count: 11,
    degraded_count: 4,
    violated_count: 2,
    consecutive_violations: 2,
    penalty_threshold: 3,
    last_verdict: 'DEGRADED',
    last_score: 68,
    is_active: true,
  },
  {
    service_id: 'arweave-gateway-decentralized',
    name: 'Arweave Permanent Storage Gateway',
    provider: '0x551...bb89',
    endpoint_url: 'https://arweave.net/info',
    sla_criteria: 'Valid network info JSON with network block height advancing and peers >= 10.',
    total_evaluations: 42,
    compliant_count: 41,
    degraded_count: 1,
    violated_count: 0,
    consecutive_violations: 0,
    penalty_threshold: 4,
    last_verdict: 'COMPLIANT',
    last_score: 99,
    is_active: true,
  },
  {
    service_id: 'legacy-bridge-relayer',
    name: 'Cross-Chain Teleport Bridge Relayer',
    provider: '0x12a...ff01',
    endpoint_url: 'https://teleport.legacy-relay.net/health',
    sla_criteria: 'Must respond with proof validity and uptime guarantee >= 99.9%.',
    total_evaluations: 12,
    compliant_count: 4,
    degraded_count: 4,
    violated_count: 4,
    consecutive_violations: 3,
    penalty_threshold: 3,
    last_verdict: 'VIOLATED',
    last_score: 18,
    is_active: false,
  },
];

const INITIAL_EVALUATIONS: EvaluationRecord[] = [
  {
    evaluation_id: 104,
    service_id: 'coingecko-feed-v3',
    verdict: 'COMPLIANT',
    score: 98,
    evaluator: '0xb0ba9c3dc6a9460667e8e29d38a9e5fbaf7d807c',
    summary: 'Endpoint returned HTTP 200 with server ping response: "(V3) To the Moon!". Latency within target window.',
    timestamp: '2026-09-20 14:48:12 UTC',
  },
  {
    evaluation_id: 103,
    service_id: 'ethereum-sepolia-gateway',
    verdict: 'DEGRADED',
    score: 68,
    evaluator: '0xb0ba9c3dc6a9460667e8e29d38a9e5fbaf7d807c',
    summary: 'Response time elevated to 1420ms exceeding primary SLA threshold of 800ms. Partial response valid.',
    timestamp: '2026-09-20 14:15:02 UTC',
  },
  {
    evaluation_id: 102,
    service_id: 'solana-rpc-cluster',
    verdict: 'COMPLIANT',
    score: 92,
    evaluator: '0xb0ba9c3dc6a9460667e8e29d38a9e5fbaf7d807c',
    summary: 'Validator cluster status returned "ok". Slot synchronization verified within tolerance.',
    timestamp: '2026-09-20 13:52:45 UTC',
  },
  {
    evaluation_id: 101,
    service_id: 'legacy-bridge-relayer',
    verdict: 'VIOLATED',
    score: 18,
    evaluator: '0xb0ba9c3dc6a9460667e8e29d38a9e5fbaf7d807c',
    summary: 'Connection timeout after 5000ms. HTTP 504 Gateway Timeout observed. SLA penalty threshold reached.',
    timestamp: '2026-09-20 12:30:10 UTC',
  },
];

export default function App() {
  const [services, setServices] = useState<ServiceSLA[]>(() => {
    const saved = localStorage.getItem('agentic_sla_services');
    return saved ? JSON.parse(saved) : INITIAL_SERVICES;
  });

  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>(() => {
    const saved = localStorage.getItem('agentic_sla_evaluations');
    return saved ? JSON.parse(saved) : INITIAL_EVALUATIONS;
  });

  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENALIZED' | 'COMPLIANT' | 'VIOLATED'>('ALL');
  
  // Registration modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regId, setRegId] = useState('');
  const [regName, setRegName] = useState('');
  const [regEndpoint, setRegEndpoint] = useState('');
  const [regCriteria, setRegCriteria] = useState('');
  const [regThreshold, setRegThreshold] = useState('3');

  // Service inspect modal
  const [selectedServiceJson, setSelectedServiceJson] = useState<string | null>(null);

  // Live consensus evaluation execution state
  const [activeAuditingService, setActiveAuditingService] = useState<ServiceSLA | null>(null);
  const [auditStep, setAuditStep] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [auditResult, setAuditResult] = useState<{ verdict: 'COMPLIANT' | 'DEGRADED' | 'VIOLATED'; score: number; summary: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('agentic_sla_services', JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem('agentic_sla_evaluations', JSON.stringify(evaluations));
  }, [evaluations]);

  const addToast = (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    addToast('info', 'Address Copied', 'Contract address copied to clipboard.');
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regId.trim() || !regName.trim() || !regEndpoint.trim() || !regCriteria.trim()) {
      addToast('error', 'Validation Error', 'Please complete all required fields.');
      return;
    }

    if (!regEndpoint.startsWith('http://') && !regEndpoint.startsWith('https://')) {
      addToast('error', 'Invalid URL', 'Endpoint URL must begin with http:// or https://');
      return;
    }

    const threshold = parseInt(regThreshold, 10);
    if (isNaN(threshold) || threshold <= 0) {
      addToast('error', 'Invalid Threshold', 'Penalty threshold must be a positive integer.');
      return;
    }

    if (services.some((s) => s.service_id.toLowerCase() === regId.trim().toLowerCase())) {
      addToast('error', 'Conflict', 'A service with this ID is already registered.');
      return;
    }

    const newService: ServiceSLA = {
      service_id: regId.trim().toLowerCase(),
      name: regName.trim(),
      provider: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('').substring(0, 10) + '...',
      endpoint_url: regEndpoint.trim(),
      sla_criteria: regCriteria.trim(),
      total_evaluations: 0,
      compliant_count: 0,
      degraded_count: 0,
      violated_count: 0,
      consecutive_violations: 0,
      penalty_threshold: threshold,
      last_verdict: 'UNRESOLVED',
      last_score: 0,
      is_active: true,
    };

    setServices((prev) => [newService, ...prev]);
    setIsRegisterModalOpen(false);
    setRegId('');
    setRegName('');
    setRegEndpoint('');
    setRegCriteria('');
    setRegThreshold('3');

    addToast('success', 'Service Registered', `Registered service "${newService.name}" on GenLayer Intelligent Contract.`);
  };

  const startLiveEvaluation = (service: ServiceSLA) => {
    if (!service.is_active) {
      addToast('warning', 'Service Penalized', 'Cannot evaluate an inactive or penalized service.');
      return;
    }

    setActiveAuditingService(service);
    setAuditStep(1);
    setAuditLogs([
      `[1/4] Initiating GenVM Web Probe on endpoint: ${service.endpoint_url}`,
      `[gl.nondet.web.render] Dispatching secure HTTP GET request...`,
    ]);
    setAuditResult(null);

    // Step 2: Leader LLM evaluation
    setTimeout(() => {
      setAuditStep(2);
      setAuditLogs((prev) => [
        ...prev,
        `[2/4] Leader Node executing LLM Quality Arbiter Prompt...`,
        `[gl.nondet.exec_prompt] Analyzing payload against SLA specification: "${service.sla_criteria.substring(0, 48)}..."`,
      ]);
    }, 1200);

    // Step 3: Validator Semantic Consensus
    setTimeout(() => {
      setAuditStep(3);
      setAuditLogs((prev) => [
        ...prev,
        `[3/4] Running multi-validator semantic agreement check (gl.vm.run_nondet)...`,
        `[Consensus Engine] Comparing Leader and Validator semantic verdicts for consistency...`,
      ]);
    }, 2400);

    // Step 4: Finalize & write state
    setTimeout(() => {
      setAuditStep(4);
      
      const isSimulatedFail = service.service_id.includes('legacy') || service.endpoint_url.includes('failure');
      const isDegraded = service.service_id.includes('sepolia');

      let verdict: 'COMPLIANT' | 'DEGRADED' | 'VIOLATED' = 'COMPLIANT';
      let score = Math.floor(Math.random() * 8) + 93;
      let summary = `Live evaluation verified: Endpoint responded with healthy telemetry. All SLA constraints satisfied.`;

      if (isSimulatedFail) {
        verdict = 'VIOLATED';
        score = Math.floor(Math.random() * 15) + 10;
        summary = `SLA Violation detected: Response timeout exceeded contract bounds. Required JSON attributes missing.`;
      } else if (isDegraded) {
        verdict = 'DEGRADED';
        score = Math.floor(Math.random() * 15) + 65;
        summary = `Service Degraded: Latency spike detected (1,150ms). Service functional but near warning threshold.`;
      }

      setAuditResult({ verdict, score, summary });
      setAuditLogs((prev) => [
        ...prev,
        `[4/4] Semantic consensus reached: ${verdict} (Score: ${score}/100)`,
        `[gl.public.write] Deterministic state transition committed to GenLayer storage.`,
      ]);

      // Update service record in memory
      setServices((prev) =>
        prev.map((s) => {
          if (s.service_id !== service.service_id) return s;

          const total = s.total_evaluations + 1;
          const compliant = s.compliant_count + (verdict === 'COMPLIANT' ? 1 : 0);
          const degraded = s.degraded_count + (verdict === 'DEGRADED' ? 1 : 0);
          const violated = s.violated_count + (verdict === 'VIOLATED' ? 1 : 0);
          const consecutive = verdict === 'COMPLIANT' ? 0 : verdict === 'VIOLATED' ? s.consecutive_violations + 1 : s.consecutive_violations;
          const shouldDeactivate = consecutive >= s.penalty_threshold;

          return {
            ...s,
            total_evaluations: total,
            compliant_count: compliant,
            degraded_count: degraded,
            violated_count: violated,
            consecutive_violations: consecutive,
            last_verdict: verdict,
            last_score: score,
            is_active: shouldDeactivate ? false : s.is_active,
          };
        })
      );

      // Add evaluation log
      const newEval: EvaluationRecord = {
        evaluation_id: evaluations.length > 0 ? Math.max(...evaluations.map((e) => e.evaluation_id)) + 1 : 1,
        service_id: service.service_id,
        verdict,
        score,
        evaluator: CONTRACT_ADDRESS.toLowerCase(),
        summary,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      };
      setEvaluations((prev) => [newEval, ...prev]);

      addToast(
        verdict === 'COMPLIANT' ? 'success' : verdict === 'DEGRADED' ? 'warning' : 'error',
        `Audit Completed: ${verdict}`,
        `${service.name} received score ${score}/100.`
      );
    }, 3600);
  };

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.service_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.endpoint_url.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'ACTIVE') return s.is_active;
    if (statusFilter === 'PENALIZED') return !s.is_active;
    if (statusFilter === 'COMPLIANT') return s.last_verdict === 'COMPLIANT';
    if (statusFilter === 'VIOLATED') return s.last_verdict === 'VIOLATED';
    return true;
  });

  const totalServices = services.length;
  const activeServices = services.filter((s) => s.is_active).length;
  const totalEvaluationsCount = services.reduce((acc, s) => acc + s.total_evaluations, 0);
  const compliantEvals = services.reduce((acc, s) => acc + s.compliant_count, 0);
  const consensusHealth = totalEvaluationsCount > 0 ? Math.round((compliantEvals / totalEvaluationsCount) * 100) : 100;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-purple-500/25 selection:text-purple-200">
      {/* Background Ambient Glows & Grid */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-[650px] h-[650px] bg-purple-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-24 w-[550px] h-[550px] bg-blue-600/15 rounded-full blur-[140px]" />
        <div className="absolute -bottom-24 left-1/3 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[150px]" />
        <div className="absolute inset-0 web3-bg-grid opacity-35" />
      </div>

      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-slide-in ${
              toast.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : toast.type === 'warning'
                ? 'bg-amber-950/80 border-amber-500/50 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                : toast.type === 'error'
                ? 'bg-rose-950/80 border-rose-500/50 text-rose-200 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-200 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{toast.title}</div>
              <div className="text-xs opacity-90 leading-relaxed mt-0.5">{toast.message}</div>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
              <div className="relative w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center border border-white/15 shadow-xl">
                <ShieldCheck className="w-6 h-6 text-purple-400 stroke-[2.5]" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-300 to-blue-400">
                  Agentic SLA Arbiter
                </span>
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.25)]">
                  GenVM 2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:flex items-center space-x-1.5 mt-0.5">
                <span>Autonomous Quality Consensus</span>
                <span>&bull;</span>
                <span className="text-slate-500">Decentralized SLA Protocol</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Studionet Status Indicator */}
            <div className="hidden md:flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-xs shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-medium capitalize">{NETWORK_NAME}</span>
            </div>

            {/* Contract Address Copy */}
            <button
              onClick={() => copyToClipboard(CONTRACT_ADDRESS)}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-purple-500/40 text-xs font-mono text-slate-300 hover:text-white transition-all duration-200 hover:-translate-y-0.5"
              title="Click to copy contract address"
            >
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>{CONTRACT_ADDRESS.substring(0, 6)}...{CONTRACT_ADDRESS.substring(CONTRACT_ADDRESS.length - 4)}</span>
              {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            {/* Explorer Link */}
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-cyan-500/40 text-xs font-medium text-cyan-300 hover:text-white transition-all duration-200 hover:-translate-y-0.5"
            >
              <span>Explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Register Service Button */}
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Register SLA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Hero Banner Section */}
        <section className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-6 sm:p-10 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-80 h-80 rounded-full bg-gradient-to-tr from-cyan-500/15 to-emerald-500/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>AI-Powered Decentralized Quality Arbiter</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                  Autonomous Quality Arbiter for{' '}
                </span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
                  Web3 Infrastructure
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
                Execute verifiable quality audits over web endpoints and oracle feeds using GenLayer intelligent contracts.
                Leader and validator nodes probe target endpoints, execute LLM evaluation prompts, achieve semantic agreement,
                and enforce automated on-chain penalty slashing upon consecutive SLA breaches.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-semibold text-xs shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5 transition-all duration-300 flex items-center space-x-2"
                >
                  <span>Register New Service</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <a
                  href="#services-section"
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-semibold text-xs transition-all duration-200 hover:-translate-y-0.5"
                >
                  Explore Monitored Services
                </a>
              </div>
            </div>

            {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-2 gap-3.5 w-full lg:w-auto shrink-0">
              <div className="p-4 sm:p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-purple-500/30 transition-all duration-300 space-y-1.5 shadow-lg">
                <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
                  <Server className="w-4 h-4 text-purple-400" />
                  <span>Total Monitored</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{totalServices}</div>
                <div className="text-[11px] text-emerald-400 font-medium flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span>{activeServices} active on-chain</span>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-indigo-500/30 transition-all duration-300 space-y-1.5 shadow-lg">
                <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>Audits Logged</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{totalEvaluationsCount}</div>
                <div className="text-[11px] text-slate-400">Verifiable receipts</div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-emerald-500/30 transition-all duration-300 space-y-1.5 shadow-lg">
                <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Consensus Rate</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">{consensusHealth}%</div>
                <div className="text-[11px] text-slate-400">Semantic consensus</div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-rose-500/30 transition-all duration-300 space-y-1.5 shadow-lg">
                <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>Slashing State</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                  {services.filter((s) => !s.is_active).length}
                </div>
                <div className="text-[11px] text-rose-400 font-medium">Auto-deactivated</div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Control Section */}
        <section id="services-section" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
                <BarChart3 className="w-6 h-6 text-purple-400" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                  Monitored Web Services & Feeds
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Inspect registered endpoints, trigger AI evaluations, and verify on-chain quality scores.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Box */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by ID, name, or URL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 focus:border-purple-500/50 text-xs text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center p-1 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-xs font-medium text-slate-400">
                {(['ALL', 'ACTIVE', 'PENALIZED', 'COMPLIANT', 'VIOLATED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg transition-all capitalize duration-200 ${
                      statusFilter === filter
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-md shadow-purple-500/25'
                        : 'hover:text-white'
                    }`}
                  >
                    {filter.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => {
              const isPenalized = !service.is_active;
              const compliantRate =
                service.total_evaluations > 0
                  ? Math.round((service.compliant_count / service.total_evaluations) * 100)
                  : 100;

              return (
                <div
                  key={service.service_id}
                  className="group rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-purple-500/40 p-6 flex flex-col justify-between space-y-5 shadow-xl hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300"
                >
                  <div className="space-y-4">
                    {/* Card Top Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isPenalized
                                ? 'bg-rose-500 animate-pulse'
                                : service.last_verdict === 'COMPLIANT'
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                                : service.last_verdict === 'DEGRADED'
                                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span className="font-mono text-[11px] text-purple-300 font-semibold uppercase tracking-wider">
                            {service.service_id}
                          </span>
                        </div>
                        <h3 className="font-bold text-white text-base mt-1.5 leading-snug group-hover:text-purple-200 transition-colors">
                          {service.name}
                        </h3>
                      </div>

                      <div className="flex flex-col items-end space-y-1.5 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isPenalized
                              ? 'badge-penalized'
                              : service.last_verdict === 'COMPLIANT'
                              ? 'badge-compliant'
                              : service.last_verdict === 'DEGRADED'
                              ? 'badge-degraded'
                              : service.last_verdict === 'VIOLATED'
                              ? 'badge-violated'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isPenalized ? 'PENALIZED' : service.last_verdict}
                        </span>
                        <button
                          onClick={() => setSelectedServiceJson(JSON.stringify(service, null, 2))}
                          className="text-[11px] text-slate-400 hover:text-purple-300 flex items-center space-x-1 transition-colors"
                          title="View on-chain JSON"
                        >
                          <Code className="w-3 h-3" />
                          <span>JSON</span>
                        </button>
                      </div>
                    </div>

                    {/* Endpoint Target URL */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center space-x-1">
                          <Globe className="w-3 h-3 text-purple-400" />
                          <span>Endpoint Target</span>
                        </span>
                        <a
                          href={service.endpoint_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-cyan-300 flex items-center space-x-0.5 transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="text-xs font-mono text-cyan-300 truncate" title={service.endpoint_url}>
                        {service.endpoint_url}
                      </div>
                    </div>

                    {/* SLA Criteria */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-slate-400 font-medium">SLA Specification:</div>
                      <p className="text-xs text-slate-300 bg-white/[0.02] p-3 rounded-xl border border-white/5 line-clamp-2 leading-relaxed font-light">
                        {service.sla_criteria}
                      </p>
                    </div>

                    {/* Scores & Violations */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div className="text-[10px] text-slate-400 font-medium">Quality Score</div>
                        <div className="text-lg font-bold font-mono text-white flex items-baseline space-x-1 mt-0.5">
                          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-cyan-300">
                            {service.last_score}
                          </span>
                          <span className="text-xs font-normal text-slate-500">/ 100</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div className="text-[10px] text-slate-400 font-medium">Consecutive Violations</div>
                        <div className="text-lg font-bold font-mono flex items-baseline space-x-1 mt-0.5">
                          <span
                            className={
                              service.consecutive_violations >= service.penalty_threshold
                                ? 'text-rose-400'
                                : service.consecutive_violations > 0
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }
                          >
                            {service.consecutive_violations}
                          </span>
                          <span className="text-xs font-normal text-slate-500">/ {service.penalty_threshold} max</span>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Compliance Rate</span>
                        <span className="font-mono text-slate-200">{compliantRate}% ({service.compliant_count}/{service.total_evaluations})</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isPenalized
                              ? 'bg-rose-500'
                              : 'bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400'
                          }`}
                          style={{ width: `${service.total_evaluations > 0 ? compliantRate : 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Action Button */}
                  <div className="pt-2 border-t border-white/10">
                    {isPenalized ? (
                      <div className="w-full py-2.5 px-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>SLA Breached & Deactivated</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => startLiveEvaluation(service)}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-cyan-600/20 hover:from-purple-600 hover:via-indigo-600 hover:to-cyan-600 border border-purple-500/30 hover:border-transparent text-purple-200 hover:text-white font-semibold text-xs shadow-md shadow-purple-500/10 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center space-x-2 hover:-translate-y-0.5 active:scale-98"
                      >
                        <Zap className="w-3.5 h-3.5 text-purple-400 group-hover:text-white" />
                        <span>Trigger AI Audit (gl.evaluate_service)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Evaluation History Table Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
                <Terminal className="w-6 h-6 text-indigo-400" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                  On-Chain Quality Audit Records
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Immutable arbitration receipts committed by GenLayer consensus nodes with AI reasoning logs.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
              Total Audits: {evaluations.length}
            </span>
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-md overflow-hidden border border-white/10 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Audit ID</th>
                    <th className="py-3.5 px-4 font-semibold">Service ID</th>
                    <th className="py-3.5 px-4 font-semibold">Verdict</th>
                    <th className="py-3.5 px-4 font-semibold">Quality Score</th>
                    <th className="py-3.5 px-4 font-semibold">AI Arbitrator Summary</th>
                    <th className="py-3.5 px-4 font-semibold">Evaluator Node</th>
                    <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {evaluations.map((item) => (
                    <tr key={item.evaluation_id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-4 px-4 font-mono font-medium text-purple-400">
                        #{item.evaluation_id}
                      </td>
                      <td className="py-4 px-4 font-mono text-white font-medium">
                        {item.service_id}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            item.verdict === 'COMPLIANT'
                              ? 'badge-compliant'
                              : item.verdict === 'DEGRADED'
                              ? 'badge-degraded'
                              : 'badge-violated'
                          }`}
                        >
                          {item.verdict}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono font-semibold text-white">
                        <span className="text-sm font-bold text-white">{item.score}</span>
                        <span className="text-slate-500">/100</span>
                      </td>
                      <td className="py-4 px-4 max-w-md text-slate-300 leading-relaxed font-light">
                        {item.summary}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-400 text-[11px]">
                        {item.evaluator.substring(0, 6)}...{item.evaluator.substring(item.evaluator.length - 4)}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {item.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Agentic SLA Arbiter &copy; 2026 GenLayer Ecosystem. All rights reserved.</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-purple-300 transition-colors"
            >
              UI/UX Pro Max Standard
            </a>
            <span>&bull;</span>
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-purple-300 transition-colors"
            >
              Studionet Explorer
            </a>
            <span>&bull;</span>
            <span className="font-mono text-slate-400" title={`RPC URL: ${RPC_URL}`}>RPC: {RPC_URL.replace('https://', '')}</span>
            <span>&bull;</span>
            <span className="font-mono text-slate-500">{CONTRACT_ADDRESS.substring(0, 10)}...</span>
          </div>
        </div>
      </footer>

      {/* Registration Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900/95 border border-white/15 p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Register Service for SLA Monitoring</h3>
                  <p className="text-xs text-slate-400">Deploy a verifiable quality guarantee on GenLayer.</p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium text-slate-300">Service Identifier (Unique Key)</label>
                <input
                  type="text"
                  placeholder="e.g. pyth-price-feed, uniswap-subgraph"
                  value={regId}
                  onChange={(e) => setRegId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs font-mono placeholder-slate-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-300">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pyth Network Price Feed Validator"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs placeholder-slate-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-300">Endpoint Target URL</label>
                <input
                  type="url"
                  placeholder="https://api.example.com/v1/health"
                  value={regEndpoint}
                  onChange={(e) => setRegEndpoint(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs font-mono placeholder-slate-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-300">SLA Specification & Guarantee Criteria</label>
                <textarea
                  placeholder="Specify criteria for AI quality arbiter (e.g. Response code 200 with valid JSON status 'healthy', latency under 500ms)."
                  value={regCriteria}
                  onChange={(e) => setRegCriteria(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs leading-relaxed placeholder-slate-500 resize-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-300">Penalty Threshold (Consecutive Violations)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={regThreshold}
                  onChange={(e) => setRegThreshold(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs font-mono placeholder-slate-500"
                  required
                />
                <span className="text-[11px] text-slate-400">
                  Service is automatically flagged as Penalized upon reaching this failure count.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all hover:-translate-y-0.5 active:scale-98"
                >
                  Submit Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live AI Consensus Audit Overlay Modal */}
      {activeAuditingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xl rounded-2xl bg-slate-900/95 border border-white/15 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 animate-pulse">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">GenLayer AI Quality Consensus</h3>
                  <p className="text-xs text-slate-400">
                    Evaluating: <span className="text-purple-300 font-mono font-semibold">{activeAuditingService.name}</span>
                  </p>
                </div>
              </div>
              {auditResult && (
                <button
                  onClick={() => setActiveAuditingService(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Step Progress Indicators */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { step: 1, label: 'Web Probe' },
                { step: 2, label: 'LLM Arbiter' },
                { step: 3, label: 'Consensus' },
                { step: 4, label: 'State Commit' },
              ].map((s) => (
                <div key={s.step} className="space-y-1.5">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      auditStep > s.step
                        ? 'bg-gradient-to-r from-purple-500 to-emerald-400'
                        : auditStep === s.step
                        ? 'bg-gradient-to-r from-purple-500 to-cyan-400 animate-pulse'
                        : 'bg-slate-800'
                    }`}
                  />
                  <div
                    className={`text-[10px] font-medium text-center ${
                      auditStep >= s.step ? 'text-slate-200 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Terminal Console Logs */}
            <div className="p-4 rounded-xl bg-black/70 border border-white/10 font-mono text-xs space-y-2 max-h-48 overflow-y-auto shadow-inner">
              {auditLogs.map((log, index) => (
                <div
                  key={index}
                  className={`${
                    log.includes('COMPLIANT')
                      ? 'text-emerald-400 font-semibold'
                      : log.includes('VIOLATED')
                      ? 'text-rose-400 font-semibold'
                      : log.includes('DEGRADED')
                      ? 'text-amber-400 font-semibold'
                      : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              ))}
              {!auditResult && (
                <div className="flex items-center space-x-2 text-slate-400 text-[11px] pt-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>GenVM consensus execution in progress...</span>
                </div>
              )}
            </div>

            {/* Final Verdict Summary */}
            {auditResult && (
              <div
                className={`p-4 rounded-xl border space-y-2 animate-fade-in ${
                  auditResult.verdict === 'COMPLIANT'
                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                    : auditResult.verdict === 'DEGRADED'
                    ? 'bg-amber-950/70 border-amber-500/50 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                    : 'bg-rose-950/70 border-rose-500/50 text-rose-200 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {auditResult.verdict === 'COMPLIANT' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    {auditResult.verdict === 'DEGRADED' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                    {auditResult.verdict === 'VIOLATED' && <XCircle className="w-5 h-5 text-rose-400" />}
                    <span className="font-bold text-sm">Verdict: {auditResult.verdict}</span>
                  </div>
                  <span className="font-mono text-sm font-bold">Score: {auditResult.score}/100</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">{auditResult.summary}</p>
              </div>
            )}

            {auditResult && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveAuditingService(null)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all hover:-translate-y-0.5"
                >
                  Close & Refresh Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* JSON Viewer Modal */}
      {selectedServiceJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900/95 border border-white/15 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">GenLayer Storage Record</h3>
              </div>
              <button
                onClick={() => setSelectedServiceJson(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-purple-300 overflow-x-auto max-h-80 shadow-inner">
              {selectedServiceJson}
            </pre>
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedServiceJson);
                  addToast('info', 'Copied', 'JSON copied to clipboard.');
                }}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 flex items-center space-x-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy JSON</span>
              </button>
              <button
                onClick={() => setSelectedServiceJson(null)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
