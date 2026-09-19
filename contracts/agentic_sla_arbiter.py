# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json


def _addr_str(addr: Address) -> str:
    """Safely format an Address instance into a lowercase hex string."""
    try:
        return addr.as_hex.lower()
    except Exception:
        return str(addr).lower()


def _get_sender_str() -> str:
    """Safely obtain sender hex string across GenVM environments."""
    try:
        sender = gl.message.sender
        return _addr_str(sender)
    except Exception:
        try:
            return _addr_str(gl.message.sender_address)
        except Exception:
            raise gl.vm.UserError("Cannot resolve sender address.")


@allow_storage
@dataclass
class ServiceSLA:
    service_id: str
    name: str
    provider: str
    endpoint_url: str
    sla_criteria: str
    total_evaluations: bigint
    compliant_count: bigint
    degraded_count: bigint
    violated_count: bigint
    consecutive_violations: bigint
    penalty_threshold: bigint
    last_verdict: str
    last_score: bigint
    is_active: bool


@allow_storage
@dataclass
class EvaluationRecord:
    evaluation_id: bigint
    service_id: str
    verdict: str
    score: bigint
    evaluator: str
    summary: str


class Contract(gl.Contract):
    """
    Agentic SLA & Quality Arbiter Primitive.
    Provides verifiable, LLM-powered quality arbitration for web services,
    RPC endpoints, and autonomous agents on the GenLayer network.
    """
    admin: str
    evaluation_counter: bigint
    service_ids: DynArray[str]
    services: TreeMap[str, ServiceSLA]
    evaluations: TreeMap[str, EvaluationRecord]

    def __init__(self):
        # GenVM automatically initializes TreeMap and DynArray collections.
        self.admin = _get_sender_str()
        self.evaluation_counter = bigint(0)

    @gl.public.write
    def register_service(
        self,
        service_id: str,
        name: str,
        endpoint_url: str,
        sla_criteria: str,
        penalty_threshold: int,
    ) -> None:
        if len(service_id.strip()) == 0:
            raise gl.vm.UserError("Service ID cannot be empty")
        if len(name.strip()) == 0:
            raise gl.vm.UserError("Service name cannot be empty")
        if not (endpoint_url.startswith("http://") or endpoint_url.startswith("https://")):
            raise gl.vm.UserError("Endpoint URL must begin with http:// or https://")
        if len(sla_criteria.strip()) == 0:
            raise gl.vm.UserError("SLA criteria specification cannot be empty")
        if penalty_threshold <= 0:
            raise gl.vm.UserError("Penalty threshold must be greater than zero")
        if service_id in self.services:
            raise gl.vm.UserError("Service with this ID already registered")

        new_service = ServiceSLA(
            service_id=service_id,
            name=name,
            provider=_get_sender_str(),
            endpoint_url=endpoint_url,
            sla_criteria=sla_criteria,
            total_evaluations=bigint(0),
            compliant_count=bigint(0),
            degraded_count=bigint(0),
            violated_count=bigint(0),
            consecutive_violations=bigint(0),
            penalty_threshold=bigint(penalty_threshold),
            last_verdict="UNRESOLVED",
            last_score=bigint(0),
            is_active=True,
        )

        self.services[service_id] = new_service
        self.service_ids.append(service_id)

    @gl.public.write
    def update_service_config(
        self,
        service_id: str,
        endpoint_url: str,
        sla_criteria: str,
        is_active: bool,
    ) -> None:
        if service_id not in self.services:
            raise gl.vm.UserError("Service not found: " + service_id)

        service = self.services[service_id]
        caller = _get_sender_str()
        if caller != service.provider and caller != self.admin:
            raise gl.vm.UserError("Unauthorized: only provider or admin can update service")

        if not (endpoint_url.startswith("http://") or endpoint_url.startswith("https://")):
            raise gl.vm.UserError("Endpoint URL must begin with http:// or https://")
        if len(sla_criteria.strip()) == 0:
            raise gl.vm.UserError("SLA criteria cannot be empty")

        service.endpoint_url = endpoint_url
        service.sla_criteria = sla_criteria
        service.is_active = is_active
        self.services[service_id] = service

    @gl.public.write
    def evaluate_service(self, service_id: str) -> str:
        if service_id not in self.services:
            raise gl.vm.UserError("Service not found: " + service_id)

        service = self.services[service_id]
        if not service.is_active:
            raise gl.vm.UserError("Cannot evaluate an inactive or penalised service")

        # Read state before non-deterministic execution.
        target_url = str(service.endpoint_url)
        criteria = str(service.sla_criteria)
        evaluator_address = _get_sender_str()

        def probe_and_arbitrate() -> str:
            raw_payload = ""
            try:
                res = gl.nondet.web.render(target_url, mode="text")
                raw_payload = res.content if hasattr(res, "content") else str(res)
            except Exception as err:
                raw_payload = "ENDPOINT_CONNECTION_FAILED: " + str(err)

            payload_snippet = raw_payload[:2500] if len(raw_payload) > 2500 else raw_payload

            prompt = (
                "You are an objective AI Quality Arbiter and SLA verification validator.\n"
                "Evaluate whether the observed endpoint payload complies with the SLA criteria.\n\n"
                "Target URL: " + target_url + "\n"
                "SLA Specification:\n" + criteria + "\n\n"
                "Observed Endpoint Payload:\n"
                "--- BEGIN PAYLOAD ---\n"
                + payload_snippet + "\n"
                "--- END PAYLOAD ---\n\n"
                "Evaluation Guidelines:\n"
                "- COMPLIANT: The payload fully satisfies the SLA criteria without errors.\n"
                "- DEGRADED: The payload is partially valid, has minor warnings, or exhibits partial degradation.\n"
                "- VIOLATED: The payload fails to respond, returns error codes, or breaches SLA guarantees.\n\n"
                "Output strictly a JSON object with this exact schema (no markdown, no backticks, no other text):\n"
                "{\"verdict\": \"COMPLIANT\", \"score\": 95, \"summary\": \"Explanation here\"}\n\n"
                "Allowed verdicts: COMPLIANT, DEGRADED, VIOLATED.\n"
                "Score must be an integer between 0 and 100."
            )

            try:
                response = gl.nondet.exec_prompt(prompt, response_format="json")
                if isinstance(response, dict):
                    parsed = response
                elif hasattr(response, "content") and isinstance(response.content, dict):
                    parsed = response.content
                else:
                    text = response.content if hasattr(response, "content") else str(response)
                    clean_resp = str(text).strip()
                    if clean_resp.startswith("```json"):
                        clean_resp = clean_resp[7:]
                    elif clean_resp.startswith("```"):
                        clean_resp = clean_resp[3:]
                    if clean_resp.endswith("```"):
                        clean_resp = clean_resp[:-3]
                    parsed = json.loads(clean_resp.strip())

                verdict = str(parsed.get("verdict", "VIOLATED")).strip().upper()
                if verdict not in ["COMPLIANT", "DEGRADED", "VIOLATED"]:
                    verdict = "VIOLATED"

                try:
                    score = int(parsed.get("score", 0))
                    score = max(0, min(100, score))
                except Exception:
                    score = 0

                summary = str(parsed.get("summary", "SLA verified by AI validator."))[:200]

                return json.dumps({
                    "verdict": verdict,
                    "score": score,
                    "summary": summary,
                }, sort_keys=True)
            except Exception as e:
                return json.dumps({
                    "verdict": "VIOLATED",
                    "score": 0,
                    "summary": f"Audit execution failed: {str(e)[:100]}",
                }, sort_keys=True)

        def leader_fn() -> str:
            return probe_and_arbitrate()

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            try:
                leader = json.loads(leader_res.calldata)
                mine = json.loads(probe_and_arbitrate())
                # Semantic consensus: validator checks semantic verdict equality only
                return str(leader.get("verdict", "")).strip().upper() == str(mine.get("verdict", "")).strip().upper()
            except Exception:
                return False

        raw_result = gl.vm.run_nondet(leader_fn, validator_fn)
        arbiter_result = json.loads(raw_result)

        verdict_str = str(arbiter_result.get("verdict", "VIOLATED")).strip().upper()
        score_val = bigint(int(arbiter_result.get("score", 0)))
        summary_str = str(arbiter_result.get("summary", "Evaluation recorded"))

        current_eval_id = self.evaluation_counter
        self.evaluation_counter = self.evaluation_counter + bigint(1)

        eval_record = EvaluationRecord(
            evaluation_id=current_eval_id,
            service_id=service_id,
            verdict=verdict_str,
            score=score_val,
            evaluator=evaluator_address,
            summary=summary_str,
        )
        self.evaluations[str(current_eval_id)] = eval_record

        # Update service SLA metrics deterministically
        service.total_evaluations = service.total_evaluations + bigint(1)
        service.last_verdict = verdict_str
        service.last_score = score_val

        if verdict_str == "COMPLIANT":
            service.compliant_count = service.compliant_count + bigint(1)
            service.consecutive_violations = bigint(0)
        elif verdict_str == "DEGRADED":
            service.degraded_count = service.degraded_count + bigint(1)
        elif verdict_str == "VIOLATED":
            service.violated_count = service.violated_count + bigint(1)
            service.consecutive_violations = service.consecutive_violations + bigint(1)
            if service.consecutive_violations >= service.penalty_threshold:
                service.is_active = False

        self.services[service_id] = service
        return verdict_str

    @gl.public.view
    def get_service_json(self, service_id: str) -> str:
        if service_id not in self.services:
            raise gl.vm.UserError("Service not found: " + service_id)
        service = self.services[service_id]
        return json.dumps({
            "service_id": service.service_id,
            "name": service.name,
            "provider": service.provider,
            "endpoint_url": service.endpoint_url,
            "sla_criteria": service.sla_criteria,
            "total_evaluations": int(service.total_evaluations),
            "compliant_count": int(service.compliant_count),
            "degraded_count": int(service.degraded_count),
            "violated_count": int(service.violated_count),
            "consecutive_violations": int(service.consecutive_violations),
            "penalty_threshold": int(service.penalty_threshold),
            "last_verdict": service.last_verdict,
            "last_score": int(service.last_score),
            "is_active": service.is_active,
        })

    @gl.public.view
    def get_service_verdict(self, service_id: str) -> str:
        if service_id not in self.services:
            raise gl.vm.UserError("Service not found: " + service_id)
        return self.services[service_id].last_verdict

    @gl.public.view
    def get_service_score(self, service_id: str) -> int:
        if service_id not in self.services:
            raise gl.vm.UserError("Service not found: " + service_id)
        return int(self.services[service_id].last_score)

    @gl.public.view
    def get_service_count(self) -> int:
        return int(len(self.service_ids))

    @gl.public.view
    def get_service_id_at(self, index: int) -> str:
        if index < 0 or index >= len(self.service_ids):
            raise gl.vm.UserError("Index out of bounds")
        return self.service_ids[index]

    @gl.public.view
    def get_evaluation_json(self, evaluation_id: int) -> str:
        key = str(evaluation_id)
        if key not in self.evaluations:
            raise gl.vm.UserError("Evaluation record not found: " + key)
        record = self.evaluations[key]
        return json.dumps({
            "evaluation_id": int(record.evaluation_id),
            "service_id": record.service_id,
            "verdict": record.verdict,
            "score": int(record.score),
            "evaluator": record.evaluator,
            "summary": record.summary,
        })

    @gl.public.view
    def get_total_evaluations(self) -> int:
        return int(self.evaluation_counter)

    @gl.public.view
    def get_admin(self) -> str:
        return self.admin
