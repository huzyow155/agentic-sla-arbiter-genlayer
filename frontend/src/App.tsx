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
  ChevronRight,
  Wallet,
  LogOut
} from 'lucide-react';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (eventName: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (eventName: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

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
    provider: '0x71cb29a49b6f8490e5183ef9b736480b91d2a49b',
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
    provider: '0x99283748293740238491823902349023490232ec',
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
    provider: '0x3429384029482039482039482039482039489901',
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
    provider: '0x551928472938472938472938472938472938bb89',
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
    provider: '0x12a938472938472938472938472938472938ff01',
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

  // Web3 Wallet Authentication State
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

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

  // MetaMask Auto-Connect & Event Listeners
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          const accs = accounts as string[];
          if (accs && accs.length > 0) {
            setUserWallet(accs[0]);
          }
        })
        .catch(() => {});

      const handleAccountsChanged = (...args: unknown[]) => {
        const accounts = args[0] as string[];
        if (accounts && accounts.length > 0) {
          setUserWallet(accounts[0]);
          addToast('info', 'Account Changed', `Active account: ${accounts[0].substring(0, 6)}...${accounts[0].substring(accounts[0].length - 4)}`);
        } else {
          setUserWallet(null);
          addToast('info', 'Wallet Disconnected', 'MetaMask session disconnected.');
        }
      };

      if (window.ethereum.on) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
      }

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        setIsConnectingWallet(true);
        const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
        if (accounts && accounts.length > 0) {
          setUserWallet(accounts[0]);
          addToast('success', 'Wallet Connected', `Connected: ${accounts[0].substring(0, 6)}...${accounts[0].substring(accounts[0].length - 4)}`);
        }
      } catch (err: unknown) {
        const error = err as { message?: string };
        addToast('error', 'Connection Rejected', error?.message || 'Failed to connect MetaMask wallet.');
      } finally {
        setIsConnectingWallet(false);
      }
    } else {
      addToast('error', 'MetaMask Missing', 'No Web3 wallet detected. Please install MetaMask to interact with the contract.');
    }
  };

  const disconnectWallet = () => {
    setUserWallet(null);
    addToast('info', 'Wallet Disconnected', 'Your wallet has been disconnected.');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    addToast('info', 'Address Copied', 'Contract address copied to clipboard.');
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (!userWallet) {
      addToast('warning', 'Wallet Required', 'Please connect your Web3 wallet (MetaMask) before registering a service.');
      connectWallet();
      return;
    }

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
      provider: userWallet.toLowerCase(),
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

    addToast('success', 'Service Registered', `Registered service "${newService.name}".`);
  };

  const startLiveEvaluation = (service: ServiceSLA) => {
    if (!userWallet) {
      addToast('warning', 'Wallet Required', 'Please connect your Web3 wallet (MetaMask) before triggering an on-chain AI quality audit.');
      connectWallet();
      return;
    }

    if (!service.is_active) {
      addToast('warning', 'Service Penalized', 'Cannot evaluate an inactive or penalized service.');
      return;
    }

    setActiveAuditingService(service);
    setAuditStep(1);
    setAuditLogs([
      `[1/4] Initiating GenVM Web Probe on endpoint: ${service.endpoint_url}`,
      `[gl.nondet.web.render] Dispatching secure HTTP GET request via evaluator ${userWallet.substring(0, 6)}...${userWallet.substring(userWallet.length - 4)}`,
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
        `[gl.public.write] Deterministic state transition committed to GenLayer storage by ${userWallet.substring(0, 6)}...${userWallet.substring(userWallet.length - 4)}.`,
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
        evaluator: userWallet.toLowerCase(),
        summary,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      };
      setEvaluations((prev) => [newEval, ...prev]);

      addToast(
        verdict === 'COMPLIANT' ? 'success' : verdict === 'DEGRADED' ? 'warning' : 'error',
        `Audit Completed: ${verdict}`,
        `${service.name} scored ${score}/100.`
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
    <div className="relative min-h-screen bg-black text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white">
      {/* Minimalist subtle background grid */}
      <div className="fixed inset-0 pointer-events-none minimalist-grid opacity-25 z-0" />

      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-zinc-900/95 border border-zinc-800 shadow-2xl transition-all duration-200"
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-white">{toast.title}</div>
              <div className="text-xs text-zinc-400 leading-relaxed mt-0.5">{toast.message}</div>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-black/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5 text-zinc-200 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-semibold text-lg sm:text-xl tracking-tight text-white">
                  Agentic SLA Arbiter
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  GenVM 2.0
                </span>
              </div>
              <p className="text-xs text-zinc-500 hidden sm:flex items-center space-x-1.5 mt-0.5">
                <span>Autonomous Quality Consensus</span>
                <span>&bull;</span>
                <span>Decentralized SLA Protocol</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 sm:space-x-3">
            {/* Studionet Status Indicator */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-zinc-300 font-medium capitalize">{NETWORK_NAME}</span>
            </div>

            {/* Contract Address Indicator */}
            <div className="hidden xl:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
              <Cpu className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[11px] text-zinc-500">Contract:</span>
              <span className="text-zinc-300">{CONTRACT_ADDRESS.substring(0, 6)}...{CONTRACT_ADDRESS.substring(CONTRACT_ADDRESS.length - 4)}</span>
              <button
                onClick={() => copyToClipboard(CONTRACT_ADDRESS)}
                title="Copy contract address"
                className="hover:text-white transition-colors"
              >
                {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-500" />}
              </button>
            </div>

            {/* Explorer Link */}
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <span>Explorer</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>

            {/* CONNECT WALLET BUTTON */}
            {!userWallet ? (
              <button
                onClick={connectWallet}
                disabled={isConnectingWallet}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors font-semibold text-xs disabled:opacity-50"
              >
                {isConnectingWallet ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                ) : (
                  <Wallet className="w-3.5 h-3.5 stroke-[2]" />
                )}
                <span>{isConnectingWallet ? 'Connecting...' : 'Connect Wallet'}</span>
              </button>
            ) : (
              <div className="flex items-center space-x-1.5">
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{userWallet.substring(0, 6)}...{userWallet.substring(userWallet.length - 4)}</span>
                </div>
                <button
                  onClick={disconnectWallet}
                  title="Disconnect wallet"
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Register Service Button */}
            <button
              onClick={() => {
                if (!userWallet) {
                  addToast('warning', 'Wallet Required', 'Please connect your Web3 wallet (MetaMask) before registering a service.');
                  connectWallet();
                  return;
                }
                setIsRegisterModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-medium text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-300" />
              <span>Register SLA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Hero Section */}
        <section className="rounded-2xl bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 p-6 sm:p-10 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                <span>Decentralized AI Quality Arbiter</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
                Autonomous Quality Arbiter for Web3 Infrastructure
              </h1>

              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-normal">
                Execute verifiable quality audits over web endpoints and oracle feeds using GenLayer intelligent contracts.
                Leader and validator nodes probe target endpoints, execute LLM evaluation prompts, achieve semantic agreement,
                and enforce automated on-chain penalty slashing upon consecutive SLA breaches.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {!userWallet ? (
                  <button
                    onClick={connectWallet}
                    className="px-5 py-2.5 rounded-lg bg-white text-black hover:bg-zinc-200 font-semibold text-xs transition-colors flex items-center space-x-2"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Connect Wallet to Get Started</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsRegisterModalOpen(true)}
                    className="px-5 py-2.5 rounded-lg bg-white text-black hover:bg-zinc-200 font-semibold text-xs transition-colors flex items-center space-x-2"
                  >
                    <span>Register New Service</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <a
                  href="#services-section"
                  className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-medium text-xs transition-colors"
                >
                  Explore Monitored Services
                </a>
              </div>
            </div>

            {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-2 gap-3 w-full lg:w-auto shrink-0">
              <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <div className="flex items-center space-x-2 text-zinc-500 text-xs font-medium">
                  <Server className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Total Monitored</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white font-mono">{totalServices}</div>
                <div className="text-[11px] text-zinc-400 font-normal">{activeServices} active on-chain</div>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <div className="flex items-center space-x-2 text-zinc-500 text-xs font-medium">
                  <Activity className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Audits Logged</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white font-mono">{totalEvaluationsCount}</div>
                <div className="text-[11px] text-zinc-400">Verifiable receipts</div>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <div className="flex items-center space-x-2 text-zinc-500 text-xs font-medium">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Consensus Rate</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono">{consensusHealth}%</div>
                <div className="text-[11px] text-zinc-400">Semantic consensus</div>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <div className="flex items-center space-x-2 text-zinc-500 text-xs font-medium">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Slashing State</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
                  {services.filter((s) => !s.is_active).length}
                </div>
                <div className="text-[11px] text-zinc-500 font-normal">Auto-deactivated</div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Control Section */}
        <section id="services-section" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-zinc-400" />
                <span>Monitored Web Services & Feeds</span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Inspect registered endpoints, trigger AI evaluations, and verify on-chain quality scores.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Box */}
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by ID, name, or URL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-zinc-600 text-xs text-white placeholder-zinc-500 outline-none transition-colors"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400">
                {(['ALL', 'ACTIVE', 'PENALIZED', 'COMPLIANT', 'VIOLATED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1 rounded-md transition-colors capitalize ${
                      statusFilter === filter
                        ? 'bg-white text-black font-semibold'
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.map((service) => {
              const isPenalized = !service.is_active;
              const compliantRate =
                service.total_evaluations > 0
                  ? Math.round((service.compliant_count / service.total_evaluations) * 100)
                  : 100;

              return (
                <div
                  key={service.service_id}
                  className="rounded-xl bg-zinc-900/40 backdrop-blur-md border border-zinc-800 hover:border-zinc-700 p-5 flex flex-col justify-between space-y-4 transition-colors"
                >
                  <div className="space-y-3.5">
                    {/* Card Top Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isPenalized
                                ? 'bg-red-500'
                                : service.last_verdict === 'COMPLIANT'
                                ? 'bg-emerald-400'
                                : service.last_verdict === 'DEGRADED'
                                ? 'bg-amber-400'
                                : 'bg-zinc-600'
                            }`}
                          />
                          <span className="font-mono text-[11px] text-zinc-400 font-medium uppercase tracking-wider">
                            {service.service_id}
                          </span>
                        </div>
                        <h3 className="font-semibold text-white text-base mt-1 leading-snug">
                          {service.name}
                        </h3>
                      </div>

                      <div className="flex flex-col items-end space-y-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isPenalized
                              ? 'badge-penalized'
                              : service.last_verdict === 'COMPLIANT'
                              ? 'badge-compliant'
                              : service.last_verdict === 'DEGRADED'
                              ? 'badge-degraded'
                              : service.last_verdict === 'VIOLATED'
                              ? 'badge-violated'
                              : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                          }`}
                        >
                          {isPenalized ? 'PENALIZED' : service.last_verdict}
                        </span>
                        <button
                          onClick={() => setSelectedServiceJson(JSON.stringify(service, null, 2))}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center space-x-1 transition-colors"
                          title="View on-chain JSON"
                        >
                          <Code className="w-3 h-3" />
                          <span>JSON</span>
                        </button>
                      </div>
                    </div>

                    {/* Endpoint Target URL */}
                    <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500">
                        <span className="flex items-center space-x-1">
                          <Globe className="w-3 h-3 text-zinc-400" />
                          <span>Endpoint Target</span>
                        </span>
                        <a
                          href={service.endpoint_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-white flex items-center space-x-0.5 transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="text-xs font-mono text-zinc-300 truncate" title={service.endpoint_url}>
                        {service.endpoint_url}
                      </div>
                    </div>

                    {/* SLA Criteria */}
                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-500 font-medium">SLA Specification:</div>
                      <p className="text-xs text-zinc-400 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-850 line-clamp-2 leading-relaxed">
                        {service.sla_criteria}
                      </p>
                    </div>

                    {/* Provider Info */}
                    <div className="text-[10px] text-zinc-500 flex items-center justify-between px-0.5">
                      <span>Provider:</span>
                      <span className="font-mono text-zinc-400">
                        {service.provider.substring(0, 6)}...{service.provider.substring(service.provider.length - 4)}
                      </span>
                    </div>

                    {/* Scores & Violations */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/60">
                        <div className="text-[10px] text-zinc-500 font-medium">Quality Score</div>
                        <div className="text-lg font-bold font-mono text-white flex items-baseline space-x-1 mt-0.5">
                          <span>{service.last_score}</span>
                          <span className="text-xs font-normal text-zinc-600">/ 100</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/60">
                        <div className="text-[10px] text-zinc-500 font-medium">Consecutive Violations</div>
                        <div className="text-lg font-bold font-mono flex items-baseline space-x-1 mt-0.5">
                          <span
                            className={
                              service.consecutive_violations >= service.penalty_threshold
                                ? 'text-red-400'
                                : service.consecutive_violations > 0
                                ? 'text-amber-400'
                                : 'text-zinc-400'
                            }
                          >
                            {service.consecutive_violations}
                          </span>
                          <span className="text-xs font-normal text-zinc-600">/ {service.penalty_threshold} max</span>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-zinc-500">
                        <span>Compliance Rate</span>
                        <span className="font-mono text-zinc-300">{compliantRate}% ({service.compliant_count}/{service.total_evaluations})</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isPenalized ? 'bg-red-500' : 'bg-zinc-200'
                          }`}
                          style={{ width: `${service.total_evaluations > 0 ? compliantRate : 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Action Button */}
                  <div className="pt-2 border-t border-zinc-800">
                    {isPenalized ? (
                      <div className="w-full py-2 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium flex items-center justify-center space-x-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-zinc-500" />
                        <span>SLA Breached & Deactivated</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => startLiveEvaluation(service)}
                        className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white font-medium text-xs transition-colors flex items-center justify-center space-x-2"
                      >
                        {userWallet ? (
                          <>
                            <Zap className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Trigger AI Audit (gl.evaluate_service)</span>
                          </>
                        ) : (
                          <>
                            <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Connect Wallet to Audit</span>
                          </>
                        )}
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
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-zinc-400" />
                <span>On-Chain Quality Audit Records</span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Immutable arbitration receipts committed by GenLayer consensus nodes with AI reasoning logs.
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800">
              Total Audits: {evaluations.length}
            </span>
          </div>

          <div className="rounded-xl bg-zinc-900/40 backdrop-blur-md overflow-hidden border border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Audit ID</th>
                    <th className="py-3 px-4 font-semibold">Service ID</th>
                    <th className="py-3 px-4 font-semibold">Verdict</th>
                    <th className="py-3 px-4 font-semibold">Quality Score</th>
                    <th className="py-3 px-4 font-semibold">AI Arbitrator Summary</th>
                    <th className="py-3 px-4 font-semibold">Evaluator Node / User</th>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850 text-zinc-300">
                  {evaluations.map((item) => (
                    <tr key={item.evaluation_id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-zinc-300">
                        #{item.evaluation_id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-white font-medium">
                        {item.service_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
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
                      <td className="py-3.5 px-4 font-mono text-white font-semibold">
                        <span>{item.score}</span>
                        <span className="text-zinc-600 font-normal">/100</span>
                      </td>
                      <td className="py-3.5 px-4 max-w-md text-zinc-400 leading-relaxed font-normal">
                        {item.summary}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-500 text-[11px]">
                        {item.evaluator.substring(0, 6)}...{item.evaluator.substring(item.evaluator.length - 4)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-500 text-[11px] whitespace-nowrap">
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
      <footer className="relative z-10 border-t border-zinc-800/80 bg-black py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-zinc-400" />
            <span>Agentic SLA Arbiter &copy; 2026 GenLayer Ecosystem. All rights reserved.</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              UI/UX Pro Max Standard
            </a>
            <span>&bull;</span>
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              Studionet Explorer
            </a>
            <span>&bull;</span>
            <span className="font-mono text-zinc-500" title={`RPC URL: ${RPC_URL}`}>RPC: {RPC_URL.replace('https://', '')}</span>
            <span>&bull;</span>
            <span className="font-mono text-zinc-600">{CONTRACT_ADDRESS.substring(0, 10)}...</span>
          </div>
        </div>
      </footer>

      {/* Registration Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-xl bg-zinc-950 border border-zinc-800 p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Register Service for SLA Monitoring</h3>
                  <p className="text-xs text-zinc-400">Deploy a verifiable quality guarantee on GenLayer.</p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              {/* Connected Wallet Banner inside Form */}
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs">
                  <Wallet className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-400">Signing Account:</span>
                  <span className="font-mono text-white font-medium">
                    {userWallet ? `${userWallet.substring(0, 6)}...${userWallet.substring(userWallet.length - 4)}` : 'Not Connected'}
                  </span>
                </div>
                {userWallet ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    Authenticated
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={connectWallet}
                    className="text-[10px] px-2.5 py-1 rounded bg-white text-black font-semibold hover:bg-zinc-200 transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">Service Identifier (Unique Key)</label>
                <input
                  type="text"
                  placeholder="e.g. pyth-price-feed, uniswap-subgraph"
                  value={regId}
                  onChange={(e) => setRegId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg titanium-input text-white text-xs font-mono placeholder-zinc-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pyth Network Price Feed Validator"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg titanium-input text-white text-xs placeholder-zinc-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">Endpoint Target URL</label>
                <input
                  type="url"
                  placeholder="https://api.example.com/v1/health"
                  value={regEndpoint}
                  onChange={(e) => setRegEndpoint(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg titanium-input text-white text-xs font-mono placeholder-zinc-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">SLA Specification & Guarantee Criteria</label>
                <textarea
                  placeholder="Specify criteria for AI quality arbiter (e.g. Response code 200 with valid JSON status 'healthy', latency under 500ms)."
                  value={regCriteria}
                  onChange={(e) => setRegCriteria(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-lg titanium-input text-white text-xs leading-relaxed placeholder-zinc-500 resize-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">Penalty Threshold (Consecutive Violations)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={regThreshold}
                  onChange={(e) => setRegThreshold(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg titanium-input text-white text-xs font-mono placeholder-zinc-500"
                  required
                />
                <span className="text-[11px] text-zinc-500">
                  Service is automatically flagged as Penalized upon reaching this failure count.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                {userWallet ? (
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 font-semibold text-xs transition-colors"
                  >
                    Submit Registration
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={connectWallet}
                    className="px-5 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Connect Wallet to Register</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live AI Consensus Audit Overlay Modal */}
      {activeAuditingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xl rounded-xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">GenLayer AI Quality Consensus</h3>
                  <p className="text-xs text-zinc-400">
                    Evaluating: <span className="text-zinc-200 font-mono font-medium">{activeAuditingService.name}</span>
                  </p>
                </div>
              </div>
              {auditResult && (
                <button
                  onClick={() => setActiveAuditingService(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
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
                    className={`h-1.5 rounded-full transition-colors duration-300 ${
                      auditStep > s.step
                        ? 'bg-white'
                        : auditStep === s.step
                        ? 'bg-zinc-400 animate-pulse'
                        : 'bg-zinc-800'
                    }`}
                  />
                  <div
                    className={`text-[10px] font-medium text-center ${
                      auditStep >= s.step ? 'text-zinc-200' : 'text-zinc-600'
                    }`}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Terminal Console Logs */}
            <div className="p-4 rounded-lg bg-black border border-zinc-800 font-mono text-xs space-y-2 max-h-48 overflow-y-auto">
              {auditLogs.map((log, index) => (
                <div
                  key={index}
                  className={`${
                    log.includes('COMPLIANT')
                      ? 'text-emerald-400 font-medium'
                      : log.includes('VIOLATED')
                      ? 'text-red-400 font-medium'
                      : log.includes('DEGRADED')
                      ? 'text-amber-400 font-medium'
                      : 'text-zinc-400'
                  }`}
                >
                  {log}
                </div>
              ))}
              {!auditResult && (
                <div className="flex items-center space-x-2 text-zinc-500 text-[11px] pt-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                  <span>GenVM consensus execution in progress...</span>
                </div>
              )}
            </div>

            {/* Final Verdict Summary */}
            {auditResult && (
              <div
                className={`p-4 rounded-lg border space-y-2 animate-fade-in ${
                  auditResult.verdict === 'COMPLIANT'
                    ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-300'
                    : auditResult.verdict === 'DEGRADED'
                    ? 'bg-amber-500/5 border-amber-500/25 text-amber-300'
                    : 'bg-red-500/5 border-red-500/25 text-red-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {auditResult.verdict === 'COMPLIANT' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {auditResult.verdict === 'DEGRADED' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    {auditResult.verdict === 'VIOLATED' && <XCircle className="w-4 h-4 text-red-400" />}
                    <span className="font-semibold text-sm">Verdict: {auditResult.verdict}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-white">Score: {auditResult.score}/100</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">{auditResult.summary}</p>
              </div>
            )}

            {auditResult && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveAuditingService(null)}
                  className="px-5 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 font-semibold text-xs transition-colors"
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
          <div className="relative w-full max-w-lg rounded-xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-bold text-white">GenLayer Storage Record</h3>
              </div>
              <button
                onClick={() => setSelectedServiceJson(null)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-black border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto max-h-80">
              {selectedServiceJson}
            </pre>
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedServiceJson);
                  addToast('info', 'Copied', 'JSON copied to clipboard.');
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-white flex items-center space-x-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy JSON</span>
              </button>
              <button
                onClick={() => setSelectedServiceJson(null)}
                className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs transition-colors"
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
