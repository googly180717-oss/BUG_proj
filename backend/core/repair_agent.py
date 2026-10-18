import os
import json
import re
import time
import threading
import random
import hashlib
from typing import Dict, Any, Optional
from backend.core.config import settings

class LLMRateLimiter:
    """Thread-safe rate limiter to prevent bursting and hitting Google Gemini / OpenAI RPM/TPM quotas."""
    def __init__(self, min_interval_seconds: float = 2.5):
        self.min_interval = min_interval_seconds
        self.last_call_time = 0.0
        self.lock = threading.Lock()

    def acquire(self) -> float:
        with self.lock:
            now = time.time()
            elapsed = now - self.last_call_time
            waited = 0.0
            if elapsed < self.min_interval:
                waited = self.min_interval - elapsed
                time.sleep(waited)
            self.last_call_time = time.time()
            return waited

def is_rate_limit_or_temporary_error(err: Exception) -> bool:
    err_str = str(err).lower()
    return any(marker in err_str for marker in [
        "429", "resource_exhausted", "resourceexhausted", "quota", 
        "rate limit", "too many requests", "503", "unavailable", 
        "high demand", "overloaded", "temporarily", "timeout", "timed out"
    ])

GEMINI_MODELS_CHAIN = [
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash"
]

SYSTEM_PROMPT_TEMPLATE = """You are an elite code analyzer and automated program repair assistant.
Your task is to analyze the target code within its specific project context, determine if a software bug or logical defect is present, and synthesize a high-fidelity patch.

================================================================================
### TARGET PROJECT & ARCHITECTURAL CONTEXT:
================================================================================
- Target Project Name: {project_name}
- Target File Path: {file_path}
- Target Architectural Role: {project_role}
- Project Technology Stack: {tech_stack}

================================================================================
### IMPORTANT CAUTION REGARDING RETRIEVED QDRANT REFERENCE:
================================================================================
The following reference was retrieved from a historical vector database (Qdrant) as a nearest structural match from past repositories:
- Reference Defect Type: {bug_type}
- Reference Blueprint (Delta Signature & Historical Twin):
{delta_signature}

CRITICAL RULES ON USING QDRANT REFERENCE:
1. The Qdrant reference is ONLY an abstract hint of a historical defect pattern from a different codebase.
2. DO NOT blindly copy foreign code, function names, package imports, or variables from the Qdrant reference into the target code.
3. You MUST evaluate the target code STRICTLY within its own target project context ({project_name}, {file_path}, {tech_stack}).

================================================================================
### TARGET USER CODE TO ANALYZE:
================================================================================
```{code_language}
{target_code}
```

================================================================================
### CRITICAL INSTRUCTIONS & DEFECT DETECTION RULES:
================================================================================
1. DO NOT SIMPLY SUGGEST "ADD A TRY-CATCH BLOCK":
   - Merely wrapping code in a generic try/catch block is a superficial band-aid and is STRICTLY FORBIDDEN as the primary suggestion.
   - NEVER inject Express backend response objects (like res.status(500).json(...)) into React frontend components or non-Express files.
   - Dig deeper to find and fix the ROOT CAUSE logical, functional, and state management errors!

2. RIGOROUSLY INSPECT FOR REAL LOGICAL ISSUES, including:
   - React State & Lifecycle: Direct state mutations (e.g., mutating array/object elements directly like `state[0].done = true; setState(state)` instead of immutable updates), stale closures, missing functional setState updates (`setState(prev => ...)`), uninitialized state (e.g., `useState()` instead of `useState([])` when mapped over in JSX).
   - Async & Promise Hazards: Missing `await` on async function calls or database queries, using unresolved Promise objects directly, missing `async` keyword on functions containing await, unhandled promise rejections.
   - Boundary & Off-by-One Errors: Loop conditions using `<= array.length` instead of `< array.length`, incorrect array slicing, indexing out-of-bounds.
   - Null / Undefined Safety: Deep property dereferences (`a.b.c.d`) without optional chaining (`?.`) or defensive guards, missing checks for empty/undefined collections before `.map()` or `.filter()`.
   - Business Logic & Control Flow: Inverted logic, incorrect comparison operators (`==` vs `===`), missing input validation, missing headers in HTTP requests (e.g. missing `Content-Type: application/json` in `fetch` POST requests), hardcoded indices instead of ID matching.

3. ACCURACY & PRESERVATION:
   - If the target code is already healthy, correct, and contains no bugs, set "is_bug_present": false and return the original code in "suggested_fix_code".
   - If a bug is present, the "suggested_fix_code" MUST be a complete, drop-in replacement of the TARGET USER CODE. Retain identical function names, parameters, imports, and surrounding logic.

Output your response strictly as valid JSON with these keys:
{{
  "is_bug_present": true,
  "bug_type": "precise string describing the defect",
  "severity_level": "Critical" | "Major" | "Minor",
  "explanation": "concise explanation of the logical root cause, project context, and the fix applied",
  "suggested_fix_code": "the exact refactored target code"
}}
"""

class GeminiKeySlot:
    """Encapsulates an individual Gemini API key, its client, health status, and failure cooldowns."""
    def __init__(self, key: str, index: int):
        self.key = key.strip()
        self.index = index
        self.masked = (self.key[:6] + "..." + self.key[-4:]) if len(self.key) > 10 else "***"
        self.client = None
        self.cooldown_until = 0.0
        self.is_disabled = False
        self.failure_reason = ""
        self.successful_calls = 0
        self._init_client()

    def _init_client(self):
        try:
            from google import genai
            self.client = genai.Client(api_key=self.key)
        except Exception as e:
            self.is_disabled = True
            self.failure_reason = str(e)
            print(f"[LLM Agent] Failed to init client for Gemini Key #{self.index} ({self.masked}): {e}")

    def is_available(self, now: float) -> bool:
        if self.is_disabled or self.client is None:
            return False
        if now < self.cooldown_until:
            return False
        return True

    def mark_cooldown(self, seconds: float = 60.0, reason: str = ""):
        self.cooldown_until = time.time() + seconds
        print(f"[LLM KeyPool] [COOLDOWN] Gemini Key #{self.index} ({self.masked}) cooling down for {int(seconds)}s. Reason: {reason}")

    def mark_disabled(self, reason: str = ""):
        self.is_disabled = True
        self.failure_reason = reason
        print(f"[LLM KeyPool] [DISABLED] Gemini Key #{self.index} ({self.masked}) permanently disabled. Reason: {reason}")


class LangChainRepairAgent:
    def __init__(self):
        self.gemini_slots: List[GeminiKeySlot] = []
        self.openai_client = None
        self.active_provider = "Deterministic AST Engine"
        self.active_model = "offline-ast-synthesis-v2"
        self.rate_limiter = LLMRateLimiter(min_interval_seconds=2.0)
        self._patch_cache: Dict[str, Dict[str, Any]] = {}
        self._model_cooldowns: Dict[str, float] = {}
        self._init_llm()

    @property
    def gemini_client(self):
        """Backward compatibility for any caller inspecting gemini_client."""
        for slot in self.gemini_slots:
            if not slot.is_disabled and slot.client is not None:
                return slot.client
        return None

    def _init_llm(self):
        # 1. Initialize Google Gemini Multi-Key Pool
        self.gemini_slots = []
        raw_keys = list(getattr(settings, "gemini_api_keys", []))
        if not raw_keys and getattr(settings, "gemini_api_key", ""):
            raw_keys = [settings.gemini_api_key]

        for idx, k in enumerate(raw_keys, start=1):
            slot = GeminiKeySlot(key=k, index=idx)
            self.gemini_slots.append(slot)

        usable_slots = [s for s in self.gemini_slots if not s.is_disabled]
        if usable_slots:
            self.active_provider = "Google Gemini (Multi-Key Pool)"
            self.active_model = "gemini-2.5-flash-lite"
            print(f"[LLM Agent] Initialized {len(usable_slots)} Google Gemini API key slot(s) with automatic failover & fallback.")
            return

        # 2. Initialize OpenAI if key provided
        openai_key = (settings.openai_api_key or "").strip()
        if openai_key:
            try:
                import openai
                self.openai_client = openai.OpenAI(api_key=openai_key)
                self.active_provider = "OpenAI"
                self.active_model = "gpt-4o-mini"
                print(f"[LLM Agent] Initialized OpenAI Client ({self.active_model}).")
                return
            except Exception as e:
                print(f"[LLM Agent] Failed to init OpenAI Client: {e}")

        print("[LLM Agent] No active API key (GEMINI_API_KEY* / OPENAI_API_KEY) configured in .env.")
        print("[LLM Agent] Operating in High-Speed Deterministic In-Context Synthesis Mode (Offline Ready).")

    def verify_and_repair(
        self,
        target_code: str,
        matched_pair: Dict[str, Any],
        similarity_score: float,
        project_name: str = "Target Project",
        file_path: str = "source.js",
        project_role: str = "Application Code",
        tech_stack: str = "JavaScript/TypeScript"
    ) -> Dict[str, Any]:
        t0 = time.time()
        delta_sig_dict = matched_pair.get("delta_signature", {})
        delta_sig_str = json.dumps(delta_sig_dict, indent=2)
        bug_type = matched_pair.get("bug_type", "Logic / Boundary Defect")

        # In-memory synthesis cache lookup to avoid redundant LLM calls and save quota
        cache_key = hashlib.sha256(f"{target_code.strip()}_{bug_type}".encode()).hexdigest()
        if cache_key in self._patch_cache:
            cached_res = dict(self._patch_cache[cache_key])
            cached_trace = dict(cached_res.get("llm_trace", {}))
            cached_trace["cache_hit"] = True
            cached_trace["latency_ms"] = 0
            cached_res["llm_trace"] = cached_trace
            print(f"[LLM Trace] Cache hit for '{file_path}' ({project_role}) - 0 tokens consumed.")
            return cached_res

        # Determine language for syntax highlighting in prompt
        code_language = "javascript"
        if file_path.endswith((".ts", ".tsx")):
            code_language = "typescript"
        elif file_path.endswith(".py"):
            code_language = "python"

        prompt_text = SYSTEM_PROMPT_TEMPLATE.format(
            project_name=project_name,
            file_path=file_path,
            project_role=project_role,
            tech_stack=tech_stack,
            bug_type=bug_type,
            delta_signature=delta_sig_str,
            code_language=code_language,
            target_code=target_code
        )

        print(f"\n[LLM Trace] >>> Evaluating '{file_path}' ({project_role})")
        print(f"[LLM Trace]     Delta-RAG Similarity: {similarity_score:.4f} | RAG Commit: {matched_pair.get('commit_id', 'twin')}")

        # 1. Try Google Gemini with Multi-Key & Multi-Model Fallback Chain
        if self.gemini_slots:
            now_time = time.time()
            # Candidate slots that aren't permanently disabled
            candidate_slots = [s for s in self.gemini_slots if not s.is_disabled]
            
            # Prioritize slots that are not in cooldown
            usable_slots = [s for s in candidate_slots if s.is_available(now_time)]
            if not usable_slots and candidate_slots:
                # If all non-disabled keys are currently cooling down, find the one closest to expiry
                earliest = min(candidate_slots, key=lambda s: s.cooldown_until)
                wait_time = max(0.0, earliest.cooldown_until - now_time)
                if wait_time <= 4.0:
                    time.sleep(wait_time)
                    usable_slots = [earliest]

            for slot in usable_slots:
                slot_succeeded = False
                for model_name in GEMINI_MODELS_CHAIN:
                    # If this model is in global cooldown, skip
                    if now_time < self._model_cooldowns.get(model_name, 0.0):
                        continue

                    max_retries = 2
                    model_completed = False
                    for attempt in range(max_retries):
                        pacing_waited = self.rate_limiter.acquire()
                        try:
                            print(f"[LLM Trace]     Dispatching prompt via Gemini Key #{slot.index} ({slot.masked}) [{model_name}] [attempt {attempt + 1}/{max_retries}]...")
                            response = slot.client.models.generate_content(
                                model=model_name,
                                contents=prompt_text
                            )
                            content = (response.text or "").strip()
                            elapsed_ms = int((time.time() - t0) * 1000)
                            json_match = re.search(r'\{[\s\S]*\}', content)
                            if json_match:
                                parsed = json.loads(json_match.group(0))
                                is_bug = parsed.get("is_bug_present", True)
                                suggested_code = parsed.get("suggested_fix_code", "").strip()

                                if suggested_code and (len(suggested_code) > 10):
                                    slot.successful_calls += 1
                                    print(f"[LLM Trace] <<< Gemini Key #{slot.index} ({model_name}) responded in {elapsed_ms}ms (is_bug={is_bug})")
                                    res_obj = {
                                        "is_bug_present": is_bug,
                                        "bug_type": parsed.get("bug_type", bug_type),
                                        "severity_level": parsed.get("severity_level", matched_pair.get("severity", "Major")),
                                        "explanation": parsed.get("explanation", matched_pair.get("root_cause", "Code refactored to resolve structural defect.")),
                                        "suggested_fix_code": suggested_code,
                                        "matched_historical_commit": matched_pair.get("commit_id", "commit-hash-twin"),
                                        "matched_commit_message": matched_pair.get("commit_message", ""),
                                        "delta_signature": delta_sig_dict,
                                        "confidence_score": round(similarity_score, 4),
                                        "llm_trace": {
                                            "status": "ONLINE_SUCCESS",
                                            "provider": "Google Gemini",
                                            "model": model_name,
                                            "key_slot": slot.index,
                                            "key_masked": slot.masked,
                                            "latency_ms": elapsed_ms,
                                            "prompt_chars": len(prompt_text),
                                            "target_file": file_path,
                                            "method_role": project_role,
                                            "project": project_name,
                                            "pacing_delay_sec": round(pacing_waited, 2)
                                        }
                                    }
                                    self._patch_cache[cache_key] = res_obj
                                    return res_obj

                            model_completed = True
                            break

                        except Exception as e:
                            err_str = str(e).lower()
                            # 1. Auth/Permission Errors: disable key and immediately fallback to next key slot
                            if any(k in err_str for k in ["401", "unauthenticated", "403", "permission_denied", "api_key_invalid", "invalid authentication", "access_token_type_unsupported"]):
                                slot.mark_disabled(reason=f"Auth/Permission rejection: {e}")
                                print(f"[LLM Fallback] [AUTH REJECTED] Gemini Key #{slot.index} ({slot.masked}) rejected. Falling back to next API key immediately...")
                                model_completed = True
                                break  # Break from model retry loop to trigger next slot

                            # 2. Rate limit / Quota exceeded: cooldown key and immediately fallback to next key slot
                            elif any(k in err_str for k in ["quota", "429", "resource_exhausted", "too many requests"]):
                                slot.mark_cooldown(seconds=60.0, reason=f"Quota exhausted: {e}")
                                print(f"[LLM Fallback] [QUOTA EXHAUSTED] Gemini Key #{slot.index} ({slot.masked}) quota exhausted. Falling back to next API key immediately...")
                                model_completed = True
                                break  # Break to next slot

                            # 3. Model not found/available on this account: try next candidate model
                            elif any(k in err_str for k in ["404", "not found", "no longer available", "not supported for generatecontent"]):
                                print(f"[LLM Trace] [MODEL UNAVAILABLE] Model {model_name} not available on Key #{slot.index}. Trying next model candidate...")
                                model_completed = True
                                break

                            # 4. Service overloaded (503): cooldown model and try next model
                            elif any(k in err_str for k in ["503", "unavailable", "high demand", "overloaded"]):
                                self._model_cooldowns[model_name] = time.time() + 30.0
                                print(f"[LLM RateLimiter] {model_name} overloaded. Rotating to next model candidate...")
                                model_completed = True
                                break

                            elif is_rate_limit_or_temporary_error(e):
                                backoff = (1.2 * (2 ** attempt)) + random.uniform(0.2, 0.5)
                                print(f"[LLM RateLimiter] Transient blip on Key #{slot.index} ({model_name}). Retrying in {backoff:.2f}s...")
                                time.sleep(backoff)
                            else:
                                print(f"[LLM Trace] Key #{slot.index} error on {model_name}: {e}. Trying fallback...")
                                model_completed = True
                                break

                    # If this slot had an auth/quota failure, break out of models chain and proceed to next slot
                    if slot.is_disabled or slot.cooldown_until > now_time:
                        break

        # 2. Try OpenAI if available
        if self.openai_client is not None:
            try:
                self.rate_limiter.acquire()
                print(f"[LLM Trace]     Dispatching prompt to OpenAI ({self.active_model})...")
                res = self.openai_client.chat.completions.create(
                    model=self.active_model,
                    messages=[{"role": "user", "content": prompt_text}],
                    temperature=0.2
                )
                content = res.choices[0].message.content.strip()
                elapsed_ms = int((time.time() - t0) * 1000)
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    is_bug = parsed.get("is_bug_present", True)
                    suggested_code = parsed.get("suggested_fix_code", "").strip()
                    if suggested_code and (len(suggested_code) > 10):
                        print(f"[LLM Trace] <<< OpenAI responded in {elapsed_ms}ms (is_bug={is_bug})")
                        res_obj = {
                            "is_bug_present": is_bug,
                            "bug_type": parsed.get("bug_type", bug_type),
                            "severity_level": parsed.get("severity_level", matched_pair.get("severity", "Major")),
                            "explanation": parsed.get("explanation", matched_pair.get("root_cause", "Code refactored to resolve structural defect.")),
                            "suggested_fix_code": suggested_code,
                            "matched_historical_commit": matched_pair.get("commit_id", "commit-hash-twin"),
                            "matched_commit_message": matched_pair.get("commit_message", ""),
                            "delta_signature": delta_sig_dict,
                            "confidence_score": round(similarity_score, 4),
                            "llm_trace": {
                                "status": "ONLINE_SUCCESS",
                                "provider": "OpenAI",
                                "model": self.active_model,
                                "latency_ms": elapsed_ms,
                                "prompt_chars": len(prompt_text),
                                "target_file": file_path,
                                "method_role": project_role,
                                "project": project_name
                            }
                        }
                        self._patch_cache[cache_key] = res_obj
                        return res_obj
            except Exception as e:
                print(f"[LLM Trace]     OpenAI call error: {e}")

        # 3. Resilient Target-Preserving Logical AST Refactoring Engine
        elapsed_ms = int((time.time() - t0) * 1000)
        mode_reason = "No external API key in .env (offline mode)" if not (settings.gemini_api_keys or settings.gemini_api_key or settings.openai_api_key) else "Cloud API fallback (all keys exhausted/errored)"
        print(f"[LLM Trace] <<< Completed via Deterministic AST Synthesis Engine ({elapsed_ms}ms) [{mode_reason}]")
        
        result = self._apply_deterministic_ast_repair(
            target_code=target_code,
            matched_pair=matched_pair,
            similarity_score=similarity_score,
            project_name=project_name,
            file_path=file_path,
            project_role=project_role,
            tech_stack=tech_stack
        )
        result["llm_trace"] = {
            "status": "OFFLINE_SYNTHESIS",
            "provider": "Deterministic AST Engine",
            "model": "offline-ast-synthesis-v2",
            "latency_ms": elapsed_ms,
            "target_file": file_path,
            "method_role": project_role,
            "project": project_name,
            "reason": mode_reason
        }
        return result

    def _apply_deterministic_ast_repair(
        self,
        target_code: str,
        matched_pair: Dict[str, Any],
        similarity_score: float,
        project_name: str = "Target Project",
        file_path: str = "source.js",
        project_role: str = "Application Code",
        tech_stack: str = "JavaScript/TypeScript"
    ) -> Dict[str, Any]:
        """
        Inspects the actual target code within its project context and applies targeted patches
        for real logical bugs (state mutations, uninitialized state, missing await, off-by-one, null safety).
        Never blindly adds generic try-catch blocks or returns foreign code.
        """
        code = target_code
        delta_sig = matched_pair.get("delta_signature", {})

        is_bug_present = False
        bug_type = matched_pair.get("bug_type", "Logic Defect")
        severity = matched_pair.get("severity", "Major")
        explanation = ""
        fixed_code = code

        is_frontend = (
            file_path.endswith((".jsx", ".tsx"))
            or "frontend" in file_path.lower()
            or "component" in file_path.lower()
            or "useState" in code
            or "useEffect" in code
            or "<" in code and ">" in code
        )
        is_express_backend = (
            "controllers" in file_path.lower()
            or "routes" in file_path.lower()
            or "server.js" in file_path.lower()
            or ("req" in code and "res" in code)
            or "router." in code
        )

        # -------------------------------------------------------------
        # Check 1: React Direct State Mutation & Missing Immutability
        # e.g., polls[0].voted = true; setPolls(polls);
        # -------------------------------------------------------------
        state_mutation_match = re.search(r'(\w+)\[\s*(\d+|\w+)\s*\]\.(\w+)\s*=\s*([^;]+);?\s*\n?\s*set\w+\(\1\);?', code)
        if is_frontend and state_mutation_match:
            var_name = state_mutation_match.group(1)
            idx_expr = state_mutation_match.group(2)
            prop_name = state_mutation_match.group(3)
            val_expr = state_mutation_match.group(4).strip()

            is_bug_present = True
            bug_type = "React Direct State Mutation & Loss of Immutability"
            severity = "Critical"
            explanation = (
                f"Direct property assignment to React state '{var_name}[{idx_expr}].{prop_name}' mutates state in place "
                f"without updating object reference, preventing React component re-renders. Replaced with immutable map update."
            )
            # Replace the mutation and setter with an immutable update
            full_mutation_stmt = state_mutation_match.group(0)
            setter_match = re.search(r'set(\w+)\(' + var_name + r'\)', full_mutation_stmt)
            setter_name = f"set{setter_match.group(1)}" if setter_match else f"set{var_name.capitalize()}"

            replacement = (
                f"// Fix: Immutable React state update to trigger proper re-render\n"
                f"    const updated{var_name.capitalize()} = ({var_name} || []).map((item, idx) => \n"
                f"      idx === {idx_expr} ? {{ ...item, {prop_name}: {val_expr} }} : item\n"
                f"    );\n"
                f"    {setter_name}(updated{var_name.capitalize()});"
            )
            fixed_code = code.replace(full_mutation_stmt, replacement)

        # -------------------------------------------------------------
        # Check 2: Uninitialized React State Before Array Mapping
        # e.g., const [polls, setPolls] = useState(); ... polls.map(...)
        # -------------------------------------------------------------
        elif is_frontend and re.search(r'const\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState\(\s*\);?', code) and ".map(" in code:
            match = re.search(r'const\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState\(\s*\);?', code)
            state_var = match.group(1) if match else "items"
            is_bug_present = True
            bug_type = "Uninitialized State Variable with Array Mapping"
            severity = "Major"
            explanation = (
                f"React state '{state_var}' is initialized to undefined via useState(), causing runtime TypeError "
                f"when {state_var}.map() executes on initial render before data is fetched. Initialized to [] and added optional chaining."
            )
            fixed_code = re.sub(
                r'useState\(\s*\)',
                'useState([])',
                code
            )
            # Add safe optional chaining to mapping
            fixed_code = re.sub(
                r'\b' + state_var + r'\.map\(',
                f'{state_var}?.map(',
                fixed_code
            )

        # -------------------------------------------------------------
        # Check 3: Missing Await on Asynchronous Operation / DB Query
        # e.g., const user = authenticateUser(...); user.id
        # or const records = fetchRecordsFromDatabase(...); records.map(...)
        # -------------------------------------------------------------
        elif re.search(r'const\s+(\w+)\s*=\s*(fetch\w+|authenticate\w+|find\w+|query\w+|get\w+FromDatabase)\([^)]*\);?\s*\n?\s*.*?\b\1\b', code) and "await " not in code:
            match = re.search(r'const\s+(\w+)\s*=\s*(fetch\w+|authenticate\w+|find\w+|query\w+|get\w+FromDatabase)\(([^)]*)\);?', code)
            var_name = match.group(1)
            call_name = match.group(2)
            args = match.group(3)

            is_bug_present = True
            bug_type = "Missing Await on Asynchronous Operation"
            severity = "Critical"
            explanation = (
                f"Asynchronous operation '{call_name}()' is invoked without 'await', causing downstream logic to operate "
                f"on an unresolved Promise object rather than resolved data. Added 'await' and ensured async signature."
            )

            # Ensure function signature is async
            if "export const " in code and " = (" in code and "async (" not in code:
                fixed_code = code.replace(" = (", " = async (")
            elif "export function " in code and "export async function " not in code:
                fixed_code = code.replace("export function ", "export async function ")
            elif "function " in code and "async function " not in code:
                fixed_code = code.replace("function ", "async function ")

            # Add await to the call
            old_call = f"const {var_name} = {call_name}({args})"
            new_call = f"const {var_name} = await {call_name}({args})"
            fixed_code = fixed_code.replace(old_call, new_call)

        # -------------------------------------------------------------
        # Check 4: Off-by-One Loop Boundary (<= length)
        # e.g., for (let i = 0; i <= polls.length; i++)
        # -------------------------------------------------------------
        elif "<=" in code and (".length" in code or ".size" in code):
            is_bug_present = True
            bug_type = "Off-by-One Array Boundary Error"
            severity = "Critical"
            explanation = (
                "Loop condition uses '<=' with array length, leading to an out-of-bounds index access and undefined dereference "
                "on the final iteration. Replaced '<=' with '<'."
            )
            # Carefully replace <= with < only when adjacent to length/size
            fixed_code = re.sub(r'<=\s*(\w+\.(?:length|size))', r'< \1', code)

        # -------------------------------------------------------------
        # Check 5: Direct Deep Property Dereference without Null Guard
        # e.g., user.profile.meta.avatarUrl or student.profile.details.fullName
        # -------------------------------------------------------------
        elif re.search(r'(\w+)\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)', code) and "?." not in code:
            is_bug_present = True
            bug_type = "Unchecked Null / Undefined Deep Property Access"
            severity = "Major"
            explanation = (
                "Direct deep nested property dereference without optional chaining (?.) risks throwing a fatal "
                "runtime TypeError if intermediate parent objects are null or undefined. Added safe optional chaining."
            )
            # Add optional chaining to deep property accesses
            fixed_code = re.sub(
                r'(\b[a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)',
                r'\1?.\2?.\3?.\4',
                code
            )

        # -------------------------------------------------------------
        # Check 6: Missing Headers in fetch POST Request
        # e.g., fetch('/api/...', { method: 'POST', body: JSON.stringify(...) })
        # -------------------------------------------------------------
        elif "fetch(" in code and "'POST'" in code and "body:" in code and "headers:" not in code:
            is_bug_present = True
            bug_type = "Missing Content-Type Header on HTTP POST"
            severity = "Major"
            explanation = (
                "fetch POST request with JSON stringified body is missing 'Content-Type': 'application/json' header, "
                "causing backend body-parser to fail to parse the incoming payload."
            )
            fixed_code = code.replace(
                "method: 'POST',",
                "method: 'POST',\n      headers: { 'Content-Type': 'application/json' },"
            )

        # -------------------------------------------------------------
        # Check 7: Unhandled Async Exception in Express Route Handler
        # ONLY apply to Express backend route handlers with (req, res), NEVER to React!
        # -------------------------------------------------------------
        elif is_express_backend and ("async " in code or "async(" in code) and ("try {" not in code and "try{" not in code):
            is_bug_present = True
            bug_type = "Unhandled Async Route Exception Boundary"
            severity = "Major"
            explanation = (
                "Express asynchronous route handler is missing a try/catch error boundary, risking server crash or "
                "hanging response upon unhandled database or network rejection."
            )
            lines = code.splitlines()
            fixed_lines = [lines[0], "  try {"]
            for line in lines[1:-1]:
                fixed_lines.append(f"  {line}")
            fixed_lines.append("  } catch (error) {")
            fixed_lines.append("    console.error('Route execution error:', error);")
            fixed_lines.append("    res.status(500).json({ error: error.message || 'Internal Server Error' });")
            fixed_lines.append("  }")
            fixed_lines.append(lines[-1] if len(lines) > 1 else "}")
            fixed_code = "\n".join(fixed_lines)

        else:
            # Code does not contain detectable logical or structural defects
            is_bug_present = False
            fixed_code = target_code
            explanation = f"Code in {file_path} follows robust structural conventions and contains no obvious defects."

        return {
            "is_bug_present": is_bug_present,
            "bug_type": bug_type,
            "severity_level": severity,
            "explanation": explanation,
            "suggested_fix_code": fixed_code,
            "matched_historical_commit": matched_pair.get("commit_id", "commit-hash-twin"),
            "matched_commit_message": matched_pair.get("commit_message", "Logical defect remediation"),
            "delta_signature": delta_sig,
            "confidence_score": round(similarity_score, 4)
        }

repair_agent = LangChainRepairAgent()

