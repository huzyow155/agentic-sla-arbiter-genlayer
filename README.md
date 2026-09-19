# Agentic SLA & Quality Arbiter Primitive

A verifiable, decentralized Service Level Agreement (SLA) and quality arbitration primitive built natively for GenLayer Intelligent Contracts.

The **Agentic SLA Arbiter** enables autonomous agents, decentralized protocols, and off-chain service consumers to monitor external web services, RPC nodes, data feeds, and API endpoints against expressive natural-language SLA criteria. Using GenLayer's non-deterministic web rendering and LLM execution capabilities with semantic consensus validation, the contract produces tamper-proof on-chain audit records and automatically penalizes defaulting services.

---

## 1. System Architecture & State Design

The contract implements clear, structured storage following GenLayer storage conventions:
- **`ServiceSLA`**: Represents a registered service endpoint, containing provider metadata, endpoint URL, natural language SLA criteria, evaluation counters, penalty thresholds, and operational status (`is_active`).
- **`EvaluationRecord`**: Historical audit log storing evaluation IDs, timestamps, qualitative verdicts, quantitative scores (0-100), evaluator addresses, and audit rationales.
- **Storage Collections**: All persistent mappings use `TreeMap[str, T]` and arrays use `DynArray[str]`.
- **Numeric Precision**: State variables strictly utilize `bigint` for deterministic persistence, while public method calldata interfaces accept standard `int`, `str`, and `bool` boundaries to prevent ABI calldata corruption.

---

## 2. Consensus & Semantic Validator Design

The make-or-break criterion for GenLayer Intelligent Contracts is **agreement on the MEANING of the result, not its format**:

### The Challenge of Non-Deterministic Evaluation
When an evaluator node probes a live web service (`gl.nondet.web.render`) and invokes the AI arbiter (`gl.nondet.exec_prompt`), different validator nodes in the GenLayer network may receive slightly varied HTTP latency snippets, minor tokenization variations, or non-identical numerical scores (e.g., Score 95 vs Score 94). A naive byte-level or JSON-string comparison would fail consensus.

### Semantic Consensus (Agreement on Substance)
In `evaluate_service`, the contract utilizes `gl.vm.run_nondet`:
1. **Leader Execution**: The leader node captures local state, executes the web probe, queries the AI arbiter prompt, and formats the output into a standardized schema (`verdict`, `score`, `summary`).
2. **Validator Verification**: The validator node independently re-executes the probe and prompt within its own sandbox. It parses both the leader's payload and its own evaluation result.
3. **Semantic Equivalence Check**: Rather than comparing volatile summaries or token-level wording, the validator compares the canonical qualitative **verdict** (`COMPLIANT`, `DEGRADED`, `VIOLATED`):
   ```python
   str(leader.get("verdict", "")).strip().upper() == str(mine.get("verdict", "")).strip().upper()
   ```
4. **Fraud & Manipulation Resistance**:
   - If the leader claims a service is `COMPLIANT` when the endpoint is returning `500 Internal Server Error` or breaching requirements, honest validator nodes observing `VIOLATED` will vote `False`, rejecting the transaction.
   - Minor non-semantic variations in the explanation summary or negligible score drift do not stall consensus. Two validators that reach different substantive conclusions will **never** both pass.

---

## 3. Public API Specification

### State-Modifying Methods (`@gl.public.write`)

- **`register_service(service_id: str, name: str, endpoint_url: str, sla_criteria: str, penalty_threshold: int) -> None`**
  Registers a new service for decentralized monitoring. Reverts if parameters are empty, invalid URL scheme, or if `service_id` already exists.

- **`update_service_config(service_id: str, endpoint_url: str, sla_criteria: str, is_active: bool) -> None`**
  Updates target URL, SLA criteria, or status. Restricted to the original service provider or the contract administrator.

- **`evaluate_service(service_id: str) -> str`**
  Initiates a decentralized audit of the specified service. Probes the endpoint, runs LLM arbitration via semantic consensus, records evaluation metrics, and deactivates (`is_active = False`) any service that exceeds its consecutive violation threshold. Returns the final verdict (`COMPLIANT`, `DEGRADED`, or `VIOLATED`).

### Read-Only Inspection Methods (`@gl.public.view`)

- **`get_service_json(service_id: str) -> str`**: Returns JSON representation of service state, metrics, and violation counters.
- **`get_service_verdict(service_id: str) -> str`**: Returns the latest evaluation verdict (`UNRESOLVED`, `COMPLIANT`, `DEGRADED`, `VIOLATED`).
- **`get_service_score(service_id: str) -> int`**: Returns the latest numerical quality score (0-100).
- **`get_service_count() -> int`**: Returns the total number of registered services.
- **`get_service_id_at(index: int) -> str`**: Returns the service ID at the specified index.
- **`get_evaluation_json(evaluation_id: int) -> str`**: Returns full audit record details for a specific evaluation ID.
- **`get_total_evaluations() -> int`**: Returns the total number of evaluations completed.
- **`get_admin() -> str`**: Returns the lowercase hex address of the contract administrator.

---

## 4. Deployment & Live Evidence

The contract is deployed and active on GenLayer StudioNet:

```yaml
NETWORK: studionet
CONTRACT_ADDRESS: "0xB0Ba9C3dC6a9460667E8e29d38A9e5fbaF7D807C"
```

### Live Query Verification (Real Result)
Queried directly from the live `studionet` network via `genlayer-py`:

```python
# Real on-chain state queried from studionet:
get_admin()              -> "0xe8c7929df0dddc368a4d25c22baa4a8bc0d07bec"
get_service_count()      -> 0
get_total_evaluations()  -> 0
```

### Worked Example Call & Expected Verdict

#### Registration Call (Illustrative Example)
```python
contract.register_service(
    service_id="binance-public-ticker",
    name="Binance Market Ticker API",
    endpoint_url="https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT",
    sla_criteria="Endpoint must return HTTP 200 with valid JSON containing symbol 'ETHUSDT' and numeric price > 0.",
    penalty_threshold=3
)
```

#### Evaluation Call & Verdict (Expected Output)
```python
# Transaction: contract.evaluate_service("binance-public-ticker")
# Expected Output Verdict:
"COMPLIANT"

# Expected Stored Service Record (JSON):
{
  "service_id": "binance-public-ticker",
  "name": "Binance Market Ticker API",
  "provider": "0x<sender_address>",
  "endpoint_url": "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT",
  "sla_criteria": "Endpoint must return HTTP 200 with valid JSON containing symbol 'ETHUSDT' and numeric price > 0.",
  "total_evaluations": 1,
  "compliant_count": 1,
  "degraded_count": 0,
  "violated_count": 0,
  "consecutive_violations": 0,
  "penalty_threshold": 3,
  "last_verdict": "COMPLIANT",
  "last_score": 98,
  "is_active": true
}
```

---

## 5. Development & Testing

### Prerequisites
- Python 3.11+
- GenLayer Test Suite (`genlayer-test`, `pytest`)

### Running the Test Suite
```bash
# 1. Create virtual environment & install dependencies
python -m venv .venv
.\.venv\Scripts\pip install -r requirements-dev.txt

# 2. Run test suite using gltest
.\.venv\Scripts\gltest.exe tests/
```

### Test Coverage Summary
- `test_contract_deployment`: Validates admin assignment and zero-state initialization.
- `test_register_service_success`: Verifies complete service lifecycle registration and attribute retrieval.
- `test_register_service_edge_cases`: Validates rigorous input sanitization (empty IDs, blank names, invalid URI schemes, non-positive thresholds, duplicate prevention).
- `test_update_service_config`: Tests authorized updates vs. unauthorized caller reverts.
- `test_evaluate_service_compliant`: Tests non-deterministic probe mocking, LLM parsing, score storage, and audit logs.
- `test_evaluate_service_degraded`: Validates degraded service handling without triggering violation penalties.
- `test_penalty_threshold_and_deactivation`: Validates consecutive violation counter tracking and automated deactivation upon reaching the penalty threshold.
- `test_consensus_semantic_agreement`: Confirms semantic equivalence validation between leader and validator nodes under simulated network variance.
