import React, { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Search,
  Server,
  Zap,
  Terminal,
  X,
  Wallet,
  LogOut,
  AlertCircle,
  Database
} from 'lucide-react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

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
  timestamp?: string;
}

interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  title: string;
  message: string;
  txHash?: string;
}

const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS || '0xB0Ba9C3dC6a9460667E8e29d38A9e5fbaF7D807C') as `0x${string}`;
const STUDIONET_CHAIN_ID_HEX = '0xf22f'; // 61999
const EXPLORER_URL = `https://studio.genlayer.com/address/${CONTRACT_ADDRESS}`;

// Read-only client instantiated against studionet
const readClient = createClient({
  chain: studionet,
});

export default function App() {
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceSLA[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [totalEvaluationsCount, setTotalEvaluationsCount] = useState<number>(0);
  const [contractAdmin, setContractAdmin] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [copiedContract, setCopiedContract] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Pending write transaction states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [auditingServiceId, setAuditingServiceId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    service_id: '',
    name: '',
    endpoint_url: '',
    sla_criteria: '',
    penalty_threshold: 3,
  });

  const addToast = useCallback((type: ToastNotification['type'], title: string, message: string, txHash?: string): string => {
    const id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    setToasts((prev) => [...prev, { id, type, title, message, txHash }]);
    if (type !== 'info') {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 7000);
    }
    return id;
  }, []);

  const updateToast = useCallback((id: string, type: ToastNotification['type'], title: string, message: string, txHash?: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, type, title, message, txHash: txHash || t.txHash } : t))
    );
    if (type !== 'info') {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 7000);
    }
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper to switch or add GenLayer Studio Network
  const checkAndSwitchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (currentChainId !== STUDIONET_CHAIN_ID_HEX) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: STUDIONET_CHAIN_ID_HEX,
                  chainName: 'GenLayer Studio Network',
                  rpcUrls: ['https://studio.genlayer.com/api'],
                  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
                  blockExplorerUrls: ['https://studio.genlayer.com'],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }
    } catch (err: any) {
      console.warn('Chain switch error:', err);
    }
  };

  // Connect MetaMask Wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      addToast('error', 'MetaMask Missing', 'Please install the MetaMask extension to sign transactions on GenLayer.');
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      if (accounts && accounts.length > 0) {
        const addr = accounts[0].toLowerCase();
        setUserWallet(addr);
        addToast('success', 'Wallet Connected', `Authenticated as ${addr.slice(0, 6)}...${addr.slice(-4)}`);
        await checkAndSwitchNetwork();
      }
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      addToast('error', 'Connection Rejected', err?.message || 'MetaMask account request was rejected.');
    }
  };

  const disconnectWallet = () => {
    setUserWallet(null);
    addToast('info', 'Disconnected', 'Wallet disconnected from active session.');
  };

  // Fetch On-Chain State directly from Intelligent Contract
  const fetchOnChainState = useCallback(async () => {
    try {
      // 1. Read admin
      try {
        const adminRes = await readClient.readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_admin',
          args: [],
        });
        if (adminRes && typeof adminRes === 'string') {
          setContractAdmin(adminRes);
        }
      } catch (e) {
        console.warn('Could not read admin address:', e);
      }

      // 2. Read service count
      const rawCount = await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_service_count',
        args: [],
      });
      const count = Number(rawCount || 0);

      // 3. Read each registered service directly from storage
      const fetchedServices: ServiceSLA[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const serviceId = (await readClient.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_service_id_at',
            args: [i],
          })) as string;

          if (serviceId) {
            const rawJson = await readClient.readContract({
              address: CONTRACT_ADDRESS,
              functionName: 'get_service_json',
              args: [serviceId],
            });
            const parsed: ServiceSLA = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
            fetchedServices.push(parsed);
          }
        } catch (err) {
          console.error(`Failed to read service at index ${i}:`, err);
        }
      }
      setServices(fetchedServices);

      // 4. Read total evaluations
      const rawTotalEvals = await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_total_evaluations',
        args: [],
      });
      const totalEvals = Number(rawTotalEvals || 0);
      setTotalEvaluationsCount(totalEvals);

      // 5. Read recent evaluations (last 10)
      const fetchedEvaluations: EvaluationRecord[] = [];
      const startIdx = Math.max(0, totalEvals - 10);
      for (let i = totalEvals - 1; i >= startIdx; i--) {
        try {
          const evalRawJson = await readClient.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_evaluation_json',
            args: [i],
          });
          const evalParsed: EvaluationRecord = typeof evalRawJson === 'string' ? JSON.parse(evalRawJson) : evalRawJson;
          fetchedEvaluations.push({
            ...evalParsed,
            timestamp: new Date().toLocaleTimeString(),
          });
        } catch (e) {
          console.error(`Failed to load evaluation ${i}:`, e);
        }
      }
      setEvaluations(fetchedEvaluations);
    } catch (error: any) {
      console.error('Error fetching on-chain state:', error);
      addToast('error', 'RPC Read Error', error?.message || 'Failed to query GenLayer studionet RPC.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [addToast]);

  // Initial load and wallet events
  useEffect(() => {
    fetchOnChainState();

    if (window.ethereum) {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: any) => {
          if (accounts && accounts.length > 0) {
            setUserWallet(accounts[0].toLowerCase());
          }
        })
        .catch(console.error);

      const handleAccountsChanged = (accounts: unknown) => {
        const accs = accounts as string[];
        if (accs && accs.length > 0) {
          setUserWallet(accs[0].toLowerCase());
        } else {
          setUserWallet(null);
        }
      };

      const handleChainChanged = () => {
        fetchOnChainState();
      };

      window.ethereum.on?.('accountsChanged', handleAccountsChanged);
      window.ethereum.on?.('chainChanged', handleChainChanged);

      return () => {
        window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, [fetchOnChainState]);

  // Real on-chain write: register_service
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userWallet) {
      addToast('warning', 'Wallet Required', 'Please connect your MetaMask wallet before registering a service.');
      return;
    }
    if (!formData.service_id.trim() || !formData.name.trim() || !formData.endpoint_url.trim() || !formData.sla_criteria.trim()) {
      addToast('warning', 'Validation Error', 'All fields are required.');
      return;
    }

    setIsSubmitting(true);
    const toastId = addToast(
      'info',
      'MetaMask Signature Requested',
      'Please approve and sign the register_service transaction in MetaMask...'
    );

    try {
      await checkAndSwitchNetwork();

      // Configure wallet client with injected MetaMask provider
      const walletClient = createClient({
        chain: studionet,
        account: userWallet as `0x${string}`,
        provider: window.ethereum as any,
      });

      const txHash = (await (walletClient.writeContract as any)({
        address: CONTRACT_ADDRESS,
        functionName: 'register_service',
        args: [
          formData.service_id.trim(),
          formData.name.trim(),
          formData.endpoint_url.trim(),
          formData.sla_criteria.trim(),
          Number(formData.penalty_threshold),
        ],
        value: 0n,
      })) as string;

      updateToast(
        toastId,
        'info',
        'Transaction Pending',
        `Transaction broadcast: ${txHash.slice(0, 10)}...${txHash.slice(-8)}. Waiting for GenLayer block confirmation...`,
        txHash
      );

      // Wait for consensus receipt
      await (readClient.waitForTransactionReceipt as any)({
        hash: txHash,
      });

      updateToast(
        toastId,
        'success',
        'Service Registered On-Chain',
        `Service [${formData.service_id}] has been committed to GenLayer storage.`,
        txHash
      );

      // Reset form and refetch state
      setFormData({
        service_id: '',
        name: '',
        endpoint_url: '',
        sla_criteria: '',
        penalty_threshold: 3,
      });
      setIsRegisterOpen(false);
      await fetchOnChainState();
    } catch (err: any) {
      console.error('Registration failed:', err);
      const msg = err?.message || 'Transaction was rejected or failed on-chain.';
      updateToast(toastId, 'error', 'Transaction Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real on-chain write: evaluate_service ("AI Audit")
  const handleEvaluate = async (serviceId: string) => {
    if (!userWallet) {
      addToast('warning', 'Wallet Required', 'Please connect your MetaMask wallet to trigger on-chain AI audits.');
      return;
    }

    setAuditingServiceId(serviceId);
    const toastId = addToast(
      'info',
      'MetaMask Signature Requested',
      `Please sign the evaluate_service transaction for [${serviceId}] in MetaMask...`
    );

    try {
      await checkAndSwitchNetwork();

      const walletClient = createClient({
        chain: studionet,
        account: userWallet as `0x${string}`,
        provider: window.ethereum as any,
      });

      const txHash = (await (walletClient.writeContract as any)({
        address: CONTRACT_ADDRESS,
        functionName: 'evaluate_service',
        args: [serviceId],
        value: 0n,
      })) as string;

      updateToast(
        toastId,
        'info',
        'AI Consensus Pending',
        `Tx ${txHash.slice(0, 10)}...${txHash.slice(-8)} submitted. GenLayer validators executing non-deterministic LLM consensus...`,
        txHash
      );

      // Wait for receipt
      await (readClient.waitForTransactionReceipt as any)({
        hash: txHash,
      });

      updateToast(
        toastId,
        'success',
        'AI Audit Confirmed',
        `GenLayer validators reached consensus for [${serviceId}]. Storage updated.`,
        txHash
      );

      await fetchOnChainState();
    } catch (err: any) {
      console.error('Audit execution failed:', err);
      const msg = err?.message || 'Evaluation transaction failed or was rejected.';
      updateToast(toastId, 'error', 'Audit Execution Failed', msg);
    } finally {
      setAuditingServiceId(null);
    }
  };

  const handleCopyContract = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const fillSampleService = () => {
    setFormData({
      service_id: 'coingecko-ping',
      name: 'CoinGecko Spot Oracle Gateway',
      endpoint_url: 'https://api.coingecko.com/api/v3/ping',
      sla_criteria: 'HTTP 200 with valid status JSON and server heartbeat ping.',
      penalty_threshold: 3,
    });
  };

  const filteredServices = services.filter(
    (s) =>
      s.service_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-neutral-800 selection:text-white flex flex-col font-sans">
      {/* Toast Notifications */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 shadow-2xl transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {toast.type === 'info' && <RefreshCw className="w-4 h-4 text-neutral-400 animate-spin mt-0.5" />}
                {toast.type === 'success' && <Check className="w-4 h-4 text-green-500 mt-0.5" />}
                {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />}
                <div>
                  <div className="text-xs font-semibold text-white uppercase tracking-wider">{toast.title}</div>
                  <div className="text-xs text-neutral-400 mt-1 leading-relaxed">{toast.message}</div>
                  {toast.txHash && (
                    <a
                      href={`https://studio.genlayer.com/tx/${toast.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400 hover:text-white mt-2 transition-colors"
                    >
                      View on Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-neutral-500 hover:text-neutral-300 p-0.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Top Navigation */}
      <header className="border-b border-neutral-800/80 bg-black/90 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="font-mono text-xs font-semibold tracking-widest text-white uppercase">
                Agentic SLA Arbiter
              </span>
            </div>
            <span className="hidden sm:inline-block text-neutral-600 font-mono text-xs">/</span>
            <div className="hidden sm:flex items-center gap-2 text-neutral-500 font-mono text-xs">
              <Database className="w-3.5 h-3.5" />
              <span>Studionet (61999)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsRefreshing(true);
                fetchOnChainState();
              }}
              disabled={isRefreshing}
              className="rounded-full border border-neutral-800 hover:border-neutral-700 bg-transparent hover:bg-neutral-900 transition-colors p-2 text-neutral-400 hover:text-white"
              title="Refresh on-chain data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
            </button>

            {userWallet ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-800 bg-[#0a0a0a] text-xs font-mono text-neutral-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span>{userWallet.slice(0, 6)}...{userWallet.slice(-4)}</span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="rounded-full border border-neutral-800 hover:border-neutral-700 bg-transparent hover:bg-neutral-900 transition-colors p-2 text-neutral-400 hover:text-white"
                  title="Disconnect wallet"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="rounded-full border border-neutral-700 bg-transparent hover:bg-neutral-900 transition-colors text-white text-xs px-4 py-1.5 flex items-center gap-2 font-mono"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 w-full space-y-16">
        {/* Hero & Intro Section */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Autonomous Quality Verification
            </h1>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl leading-relaxed">
              Verifiable SLA enforcement on GenLayer. Non-deterministic web probes and LLM consensus
              autonomously arbitrate service performance directly on-chain.
            </p>
          </div>

          {/* Contract Address Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-neutral-400">
            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-neutral-800/80 rounded-xl px-3 py-2">
              <span className="text-neutral-500">Contract:</span>
              <span className="text-neutral-300">{CONTRACT_ADDRESS}</span>
              <button
                onClick={handleCopyContract}
                className="text-neutral-400 hover:text-white transition-colors ml-1"
                title="Copy address"
              >
                {copiedContract ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {contractAdmin && (
              <div className="flex items-center gap-2 bg-[#0a0a0a] border border-neutral-800/80 rounded-xl px-3 py-2">
                <span className="text-neutral-500">Admin:</span>
                <span className="text-neutral-300">{contractAdmin.slice(0, 6)}...{contractAdmin.slice(-4)}</span>
              </div>
            )}

            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-neutral-800 hover:border-neutral-700 bg-transparent hover:bg-neutral-900 transition-colors text-neutral-400 hover:text-white px-3 py-2 flex items-center gap-1.5"
            >
              <span>Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* High-Level Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl p-5 space-y-1">
            <div className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Services Registered</div>
            <div className="text-2xl font-mono font-semibold text-white">
              {isLoading ? '...' : services.length}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">On-chain storage array</div>
          </div>

          <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl p-5 space-y-1">
            <div className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Total AI Audits</div>
            <div className="text-2xl font-mono font-semibold text-white">
              {isLoading ? '...' : totalEvaluationsCount}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">Consensus executions</div>
          </div>

          <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl p-5 space-y-1">
            <div className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Active Status</div>
            <div className="text-2xl font-mono font-semibold text-white">
              {isLoading ? '...' : services.filter((s) => s.is_active).length}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">Unpenalized endpoints</div>
          </div>

          <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl p-5 space-y-1">
            <div className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Execution Model</div>
            <div className="text-xl font-mono font-semibold text-white truncate">GenVM LLM</div>
            <div className="text-[11px] text-neutral-500 font-mono">Semantic consensus</div>
          </div>
        </div>

        {/* Services Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Registered Service Endpoints</h2>
              <p className="text-xs text-neutral-400 font-mono">
                Live on-chain SLAs tracked and arbitrated by GenLayer intelligent contracts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Filter by ID or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#050505] border border-neutral-800 text-white rounded-full pl-8 pr-4 py-1.5 text-xs font-mono focus:border-neutral-600 outline-none w-48 sm:w-64 placeholder:text-neutral-600"
                />
              </div>

              <button
                onClick={() => setIsRegisterOpen(true)}
                className="rounded-full border border-neutral-700 bg-transparent hover:bg-neutral-900 transition-colors text-white text-xs px-4 py-1.5 flex items-center gap-1.5 font-mono shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Service</span>
              </button>
            </div>
          </div>

          {/* Services List / Empty State */}
          {isLoading ? (
            <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl p-12 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-neutral-500 mx-auto" />
              <div className="text-xs font-mono text-neutral-400">Loading on-chain records from GenLayer studionet...</div>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl p-12 text-center space-y-4">
              <div className="w-10 h-10 rounded-full border border-neutral-800 flex items-center justify-center mx-auto text-neutral-600">
                <Server className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-mono text-white">No services registered on-chain yet</div>
                <div className="text-xs text-neutral-500 max-w-md mx-auto">
                  The smart contract currently has 0 registered services. Connect your wallet and register
                  the first service to start autonomous SLA arbitration.
                </div>
              </div>
              <button
                onClick={() => {
                  fillSampleService();
                  setIsRegisterOpen(true);
                }}
                className="rounded-full border border-neutral-700 bg-transparent hover:bg-neutral-900 transition-colors text-white text-xs px-4 py-2 font-mono"
              >
                Register Sample Service
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredServices.map((service) => {
                const isAuditing = auditingServiceId === service.service_id;
                return (
                  <div
                    key={service.service_id}
                    className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl p-6 flex flex-col justify-between space-y-5 hover:border-neutral-700 transition-colors"
                  >
                    <div className="space-y-4">
                      {/* Header row: ID + Status accent */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-mono text-neutral-400">{service.service_id}</div>
                          <div className="text-base font-medium text-white mt-0.5">{service.name}</div>
                        </div>

                        {/* Terminal style status accents: COMPLIANT (text-green-500), VIOLATED (text-red-500) */}
                        <div className="font-mono text-xs uppercase shrink-0 pt-0.5">
                          {!service.is_active ? (
                            <span className="text-red-500">[PENALIZED]</span>
                          ) : service.last_verdict === 'COMPLIANT' ? (
                            <span className="text-green-500">● COMPLIANT</span>
                          ) : service.last_verdict === 'VIOLATED' ? (
                            <span className="text-red-500">● VIOLATED</span>
                          ) : service.last_verdict === 'DEGRADED' ? (
                            <span className="text-yellow-500">● DEGRADED</span>
                          ) : (
                            <span className="text-neutral-500">○ UNRESOLVED</span>
                          )}
                        </div>
                      </div>

                      {/* Endpoint URL & Criteria */}
                      <div className="space-y-2 text-xs font-mono">
                        <div className="bg-[#050505] border border-neutral-900 rounded-lg p-2.5 break-all text-neutral-400">
                          <span className="text-neutral-600 select-none">URL: </span>
                          {service.endpoint_url}
                        </div>
                        <p className="text-neutral-400 font-sans text-xs line-clamp-2 leading-relaxed">
                          {service.sla_criteria}
                        </p>
                      </div>

                      {/* On-Chain Metrics Grid */}
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-neutral-900 text-center font-mono">
                        <div className="p-2 bg-[#050505] rounded-lg">
                          <div className="text-[10px] text-neutral-500">Score</div>
                          <div className="text-xs font-semibold text-white mt-0.5">
                            {service.last_score > 0 ? `${service.last_score}%` : 'N/A'}
                          </div>
                        </div>
                        <div className="p-2 bg-[#050505] rounded-lg">
                          <div className="text-[10px] text-neutral-500">Evals</div>
                          <div className="text-xs font-semibold text-white mt-0.5">
                            {service.total_evaluations}
                          </div>
                        </div>
                        <div className="p-2 bg-[#050505] rounded-lg">
                          <div className="text-[10px] text-neutral-500">Passed</div>
                          <div className="text-xs font-semibold text-green-500 mt-0.5">
                            {service.compliant_count}
                          </div>
                        </div>
                        <div className="p-2 bg-[#050505] rounded-lg">
                          <div className="text-[10px] text-neutral-500">Violations</div>
                          <div className="text-xs font-semibold text-red-500 mt-0.5">
                            {service.violated_count}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-neutral-900">
                      <div className="text-[11px] font-mono text-neutral-500 truncate max-w-[180px]">
                        by {service.provider.slice(0, 6)}...{service.provider.slice(-4)}
                      </div>

                      <button
                        onClick={() => handleEvaluate(service.service_id)}
                        disabled={isAuditing || !service.is_active}
                        className={`rounded-full border border-neutral-700 bg-transparent hover:bg-neutral-900 transition-colors text-white text-xs px-4 py-1.5 flex items-center gap-1.5 font-mono ${
                          isAuditing ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isAuditing ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-white" />
                            <span>Arbitrating...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3 text-neutral-300" />
                            <span>AI Audit</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* On-Chain Arbitration Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Consensus Arbitration Log</h2>
              <p className="text-xs text-neutral-400 font-mono">
                Recent evaluation records parsed from GenLayer contract storage.
              </p>
            </div>
            <div className="font-mono text-xs text-neutral-500">
              Total Recorded: {totalEvaluationsCount}
            </div>
          </div>

          {evaluations.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl p-8 text-center text-xs font-mono text-neutral-500">
              No evaluation records stored yet. Execute an AI Audit above to trigger GenLayer consensus.
            </div>
          ) : (
            <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl divide-y divide-neutral-900 font-mono text-xs overflow-hidden">
              {evaluations.map((item) => (
                <div key={item.evaluation_id} className="p-4 space-y-2 hover:bg-neutral-950/50 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500">#{item.evaluation_id}</span>
                      <span className="text-white font-semibold">{item.service_id}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.verdict === 'COMPLIANT' && <span className="text-green-500">● COMPLIANT</span>}
                      {item.verdict === 'VIOLATED' && <span className="text-red-500">● VIOLATED</span>}
                      {item.verdict === 'DEGRADED' && <span className="text-yellow-500">● DEGRADED</span>}
                      <span className="text-neutral-300 font-semibold">{item.score}/100</span>
                      {item.timestamp && <span className="text-neutral-600 text-[11px]">{item.timestamp}</span>}
                    </div>
                  </div>

                  <p className="text-neutral-400 font-sans text-xs leading-relaxed">
                    {item.summary}
                  </p>

                  <div className="text-[11px] text-neutral-600 truncate">
                    Evaluator: {item.evaluator}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Technical Specification Box */}
        <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-white font-mono text-xs font-semibold tracking-wider uppercase">
            <Terminal className="w-4 h-4 text-neutral-400" />
            <span>GenLayer Intelligent Contract Interface</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-neutral-400">
            <div className="bg-[#050505] p-3 rounded-xl border border-neutral-900 space-y-1">
              <div className="text-neutral-500 text-[11px]">Write Methods (MetaMask Gas)</div>
              <div className="text-neutral-200">register_service(id, name, url, criteria, threshold)</div>
              <div className="text-neutral-200">evaluate_service(id)</div>
            </div>

            <div className="bg-[#050505] p-3 rounded-xl border border-neutral-900 space-y-1">
              <div className="text-neutral-500 text-[11px]">View Methods (Gasless RPC)</div>
              <div className="text-neutral-200">get_service_count() -&gt; int</div>
              <div className="text-neutral-200">get_service_json(id) -&gt; json_str</div>
            </div>
          </div>
        </div>
      </main>

      {/* Register Service Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-white">Register SLA Endpoint</h3>
                <p className="text-xs text-neutral-400 font-mono">Sign transaction via MetaMask onto GenLayer</p>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-neutral-400">Service Identifier (slug)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. coingecko-ping"
                  value={formData.service_id}
                  onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                  className="w-full bg-[#050505] border border-neutral-800 text-white rounded-xl px-3.5 py-2 text-xs font-mono focus:border-neutral-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-neutral-400">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CoinGecko Spot Oracle Gateway"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#050505] border border-neutral-800 text-white rounded-xl px-3.5 py-2 text-xs focus:border-neutral-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-neutral-400">Endpoint URL (HTTP / HTTPS)</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.coingecko.com/api/v3/ping"
                  value={formData.endpoint_url}
                  onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                  className="w-full bg-[#050505] border border-neutral-800 text-white rounded-xl px-3.5 py-2 text-xs font-mono focus:border-neutral-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-neutral-400">SLA Criteria Specification</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. HTTP 200 with valid status JSON and server heartbeat ping."
                  value={formData.sla_criteria}
                  onChange={(e) => setFormData({ ...formData, sla_criteria: e.target.value })}
                  className="w-full bg-[#050505] border border-neutral-800 text-white rounded-xl px-3.5 py-2 text-xs focus:border-neutral-500 outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-neutral-400">
                  Penalty Threshold (Consecutive Violations)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={formData.penalty_threshold}
                  onChange={(e) => setFormData({ ...formData, penalty_threshold: parseInt(e.target.value) || 3 })}
                  className="w-full bg-[#050505] border border-neutral-800 text-white rounded-xl px-3.5 py-2 text-xs font-mono focus:border-neutral-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={fillSampleService}
                  className="text-xs font-mono text-neutral-400 hover:text-white transition-colors"
                >
                  Fill Sample Data
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="rounded-full border border-neutral-800 hover:border-neutral-700 bg-transparent hover:bg-neutral-900 transition-colors text-neutral-400 text-xs px-4 py-2 font-mono"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-full border border-neutral-700 bg-transparent hover:bg-neutral-900 transition-colors text-white text-xs px-5 py-2 flex items-center gap-2 font-mono font-medium disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Confirming in MetaMask...</span>
                      </>
                    ) : (
                      <span>Sign &amp; Register</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-8 bg-black">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-500">
          <div>Agentic SLA Arbiter: GenLayer Intelligent Contract</div>
          <div className="flex items-center gap-4">
            <a
              href="https://genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GenLayer Network
            </a>
            <span>•</span>
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Contract Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
