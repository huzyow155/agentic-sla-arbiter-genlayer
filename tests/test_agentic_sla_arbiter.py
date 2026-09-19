import json
import pytest
from gltest.direct.loader import create_address


def _to_hex_str(addr: bytes) -> str:
    return "0x" + addr.hex().lower()


def test_contract_deployment(direct_vm, direct_deploy):
    admin = create_address("admin")
    direct_vm.sender = admin
    contract = direct_deploy("contracts/agentic_sla_arbiter.py")

    assert contract.get_admin() == _to_hex_str(admin)
    assert contract.get_total_evaluations() == 0
    assert contract.get_service_count() == 0


def test_register_service_success(direct_vm, direct_deploy):
    provider = create_address("provider")
    direct_vm.sender = provider
    contract = direct_deploy("contracts/agentic_sla_arbiter.py")

    contract.register_service(
        service_id="svc-rpc-node-1",
        name="Mainnet RPC Node",
        endpoint_url="https://rpc.example.org/health",
        sla_criteria="Uptime 99.9%, latency < 200ms, status code 200",
        penalty_threshold=3,
    )

    assert contract.get_service_count() == 1
    assert contract.get_service_id_at(0) == "svc-rpc-node-1"

    data = json.loads(contract.get_service_json("svc-rpc-node-1"))
    assert data["service_id"] == "svc-rpc-node-1"
    assert data["name"] == "Mainnet RPC Node"
    assert data["provider"] == _to_hex_str(provider)
    assert data["endpoint_url"] == "https://rpc.example.org/health"
    assert data["penalty_threshold"] == 3
    assert data["is_active"] is True
    assert data["last_verdict"] == "UNRESOLVED"
    assert data["total_evaluations"] == 0


def test_register_service_edge_cases(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/agentic_sla_arbiter.py")

    # Empty service_id
    with direct_vm.expect_revert("Service ID cannot be empty"):
        contract.register_service(
            service_id="   ",
            name="Node",
            endpoint_url="https://rpc.example.org",
            sla_criteria="Active",
            penalty_threshold=3,
        )

    # Empty name
    with direct_vm.expect_revert("Service name cannot be empty"):
        contract.register_service(
            service_id="svc-1",
            name="",
            endpoint_url="https://rpc.example.org",
            sla_criteria="Active",
            penalty_threshold=3,
        )

    # Invalid URL scheme
    with direct_vm.expect_revert("Endpoint URL must begin with http:// or https://"):
        contract.register_service(
            service_id="svc-1",
            name="Node",
            endpoint_url="ftp://rpc.example.org",
            sla_criteria="Active",
            penalty_threshold=3,
        )

    # Empty criteria
    with direct_vm.expect_revert("SLA criteria specification cannot be empty"):
        contract.register_service(
            service_id="svc-1",
            name="Node",
            endpoint_url="https://rpc.example.org",
            sla_criteria="   ",
            penalty_threshold=3,
        )

    # Zero penalty threshold
    with direct_vm.expect_revert("Penalty threshold must be greater than zero"):
        contract.register_service(
            service_id="svc-1",
            name="Node",
            endpoint_url="https://rpc.example.org",
            sla_criteria="Active",
            penalty_threshold=0,
        )

    # Register valid service
    contract.register_service(
        service_id="svc-1",
        name="Node",
        endpoint_url="https://rpc.example.org",
        sla_criteria="Active",
        penalty_threshold=2,
    )

    # Duplicate registration
    with direct_vm.expect_revert("Service with this ID already registered"):
        contract.register_service(
            service_id="svc-1",
            name="Node Duplicate",
            endpoint_url="https://rpc2.example.org",
            sla_criteria="Active",
            penalty_threshold=2,
        )


def test_update_service_config(direct_vm, direct_deploy):
    admin = create_address("admin")
    provider = create_address("provider")
    other = create_address("other")

    direct_vm.sender = admin
    contract = direct_deploy("contracts/agentic_sla_arbiter.py")

    with direct_vm.prank(provider):
        contract.register_service(
            service_id="svc-api",
            name="Public API",
            endpoint_url="https://api.example.org",
            sla_criteria="Latency < 100ms",
            penalty_threshold=3,
        )

    # Unauthorized caller
    with direct_vm.prank(other):
        with direct_vm.expect_revert("Unauthorized"):
            contract.update_service_config(
                service_id="svc-api",
                endpoint_url="https://hacked.example.org",
                sla_criteria="Bad",
                is_active=True,
            )

    # Inexistent service
    with direct_vm.prank(admin):
        with direct_vm.expect_revert("Service not found: nonexistent"):
            contract.update_service_config(
                service_id="nonexistent",
                endpoint_url="https://api.example.org",
                sla_criteria="Active",
                is_active=True,
            )

    # Provider updates config
    with direct_vm.prank(provider):
        contract.update_service_config(
            service_id="svc-api",
            endpoint_url="https://api.example.org/v2",
            sla_criteria="Latency < 50ms",
            is_active=True,
        )

    svc = json.loads(contract.get_service_json("svc-api"))
    assert svc["endpoint_url"] == "https://api.example.org/v2"
    assert svc["sla_criteria"] == "Latency < 50ms"


def test_evaluate_service_compliant(direct_vm, direct_deploy):
    provider = create_address("provider")
    evaluator = create_address("evaluator")

    direct_vm.sender = provider
    contract = direct_deploy("contracts/agentic_sla_arbiter.py")

    contract.register_service(
        service_id="oracle-service",
        name="Oracle Price Feed",
        endpoint_url="https://oracle.example.org/health",
        sla_criteria="Status OK and healthy prices",
        penalty_threshold=2,
    )

    # Mock web render and LLM arbiter
    direct_vm.mock_web(
        r".*oracle\.example\.org.*",
        {"status": 200, "body": '{"status": "ok", "latency_ms": 42}'},
    )
    direct_vm.mock_llm(
        r".*",
        json.dumps({
            "verdict": "COMPLIANT",
            "score": 98,
            "summary": "Oracle health endpoint returns valid status within SLA threshold.",
        }),
    )

    with direct_vm.prank(evaluator):
        verdict = contract.evaluate_service("oracle-service")

    assert verdict == "COMPLIANT"
    assert contract.get_service_verdict("oracle-service") == "COMPLIANT"
    assert contract.get_service_score("oracle-service") == 98

    svc = json.loads(contract.get_service_json("oracle-service"))
    assert svc["total_evaluations"] == 1
    assert svc["compliant_count"] == 1
    assert svc["consecutive_violations"] == 0

    assert contract.get_total_evaluations() == 1
    eval_rec = json.loads(contract.get_evaluation_json(0))
    assert eval_rec["verdict"] == "COMPLIANT"
    assert eval_rec["score"] == 98
    assert eval_rec["evaluator"] == _to_hex_str(evaluator)


def test_evaluate_service_degraded(direct_vm, direct_deploy):
    provider = create_address("provider")
    direct_vm.sender = provider
    contract = direct_deploy("contracts/agentic_sla_arbiter.py")

    contract.register_service(
        service_id="svc-slow",
        name="Slow API",
        endpoint_url="https://slow.example.org",
        sla_criteria="Latency < 100ms",
        penalty_threshold=3,
    )

    direct_vm.mock_web(r".*", {"status": 200, "body": '{"status": "ok", "latency_ms": 850}'})
    direct_vm.mock_llm(
        r".*",
        json.dumps({
            "verdict": "DEGRADED",
            "score": 60,
            "summary": "Endpoint responds but latency 850ms exceeds target.",
        }),
    )

    verdict = contract.evaluate_service("svc-slow")
    assert verdict == "DEGRADED"

    svc = json.loads(contract.get_service_json("svc-slow"))
    assert svc["degraded_count"] == 1
    assert svc["consecutive_violations"] == 0
    assert svc["is_active"] is True


def test_penalty_threshold_and_deactivation(direct_vm, direct_deploy):
    provider = create_address("provider")
    direct_vm.sender = provider
    contract = direct_deploy("contracts/agentic_sla_arbiter.py")

    contract.register_service(
        service_id="flaky-svc",
        name="Flaky Endpoint",
        endpoint_url="https://flaky.example.org",
        sla_criteria="200 OK",
        penalty_threshold=2,
    )

    direct_vm.mock_web(r".*", {"status": 500, "body": "Internal Server Error"})
    direct_vm.mock_llm(
        r".*",
        json.dumps({
            "verdict": "VIOLATED",
            "score": 5,
            "summary": "500 Internal Server Error breaches uptime SLA.",
        }),
    )

    # First violation
    contract.evaluate_service("flaky-svc")
    svc = json.loads(contract.get_service_json("flaky-svc"))
    assert svc["violated_count"] == 1
    assert svc["consecutive_violations"] == 1
    assert svc["is_active"] is True

    # Second consecutive violation triggers penalty deactivation
    contract.evaluate_service("flaky-svc")
    svc2 = json.loads(contract.get_service_json("flaky-svc"))
    assert svc2["violated_count"] == 2
    assert svc2["consecutive_violations"] == 2
    assert svc2["is_active"] is False

    # Inactive service cannot be evaluated
    with direct_vm.expect_revert("Cannot evaluate an inactive or penalised service"):
        contract.evaluate_service("flaky-svc")


def test_consensus_semantic_agreement(direct_vm, direct_deploy):
    provider = create_address("provider")
    direct_vm.sender = provider
    contract = direct_deploy("contracts/agentic_sla_arbiter.py")

    contract.register_service(
        service_id="consensus-svc",
        name="Consensus Target",
        endpoint_url="https://consensus.example.org",
        sla_criteria="Active status",
        penalty_threshold=3,
    )

    # Leader produces COMPLIANT
    direct_vm.mock_web(r".*", {"status": 200, "body": "OK"})
    direct_vm.mock_llm(
        r".*",
        json.dumps({
            "verdict": "COMPLIANT",
            "score": 95,
            "summary": "Verified by leader node.",
        }),
    )
    contract.evaluate_service("consensus-svc")

    # Validator also observes COMPLIANT (even if score or summary slightly differs)
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": "OK"})
    direct_vm.mock_llm(
        r".*",
        json.dumps({
            "verdict": "COMPLIANT",
            "score": 92,
            "summary": "Validator agrees service is compliant.",
        }),
    )
    assert direct_vm.run_validator() is True

    # Validator disagrees when observing a different semantic verdict
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 500, "body": "Error"})
    direct_vm.mock_llm(
        r".*",
        json.dumps({
            "verdict": "VIOLATED",
            "score": 0,
            "summary": "Validator observed violation.",
        }),
    )
    assert direct_vm.run_validator() is False
