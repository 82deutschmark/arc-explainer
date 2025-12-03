# Poetiq Meta-System – LLM Agnosticism & Temperature Defaults

**Audience:** Anyone wondering why Poetiq defaults to `temperature = 1.0` even though individual LLM vendors expose different sampling knobs.  
**Last updated:** 2025-11-27 by Codex (GPT-5).

## 1. How the Poetiq stack stays LLM-agnostic

1. **UI / API layer** – `client/src/pages/PoetiqSolver.tsx` exposes provider, model, expert count, and temperature knobs. Requests land in `POST /api/poetiq/solve/:taskId` (`server/controllers/poetiqController.ts`), which simply forwards those values without caring which vendor is selected.
2. **Service layer** – `server/services/poetiq/poetiqService.ts` spawns `server/python/poetiq_wrapper.py`, stuffing only the requested model id, temperature, and BYO API key into the child process env. There is no provider-specific branch here.
3. **Python bridge** – `poetiq_wrapper.py` builds a per-expert config list (`build_config_list`), attaching the supplied `solver_temperature` and any optional reasoning knobs, then directly calls `arc_agi.solve_parallel_coding`.
4. **LLM shim** – Inside the Poetiq submodule, `poetiq-solver/arc_agi/llm.py` funnels every request through LiteLLM (`litellm.acompletion`). LiteLLM is the true LLM-agnostic abstraction: it knows each provider’s schema, strips unsupported fields, fills in defaults (like Gemini’s top-p = 0.95), and injects extra arguments such as Anthropic’s `thinking` budgets or GPT-5’s `reasoning_effort`. Because Poetiq only talks to LiteLLM, we never have to fork logic per vendor.

If a provider flat-out rejects a parameter, LiteLLM raises the error and Poetiq simply retries (see the retry loop in `arc_agi/llm.py`). That “strict adapter + retry” pattern keeps the solver portable even though we surface a single temperature slider to the user.

## 2. Why the default temperature is 1.0

* **Poetiq is a search, not a single-shot guess.** Each expert iterates until its Python program solves every training example. Any hallucinated code fails fast. Higher temperatures therefore promote _diverse starting points_ without compromising correctness because failing programs are discarded before they can touch the test grid.
* **Parallel experts need diversity more than determinism.** With `numExperts = 8`, the metagame is to explore different strategies, then vote. Temperatures around 0.2 made all experts converge on the same loop-unroll template during internal testing, which killed coverage on ARC-AGI-2 puzzles. Bumping to 1.0 restored the spread of hypotheses while keeping runtime stable.
* **Provider defaults differ wildly.** Gemini already caps effective randomness via `top_p = 0.95`, Anthropic hard-limits `temperature <= 1`, and OpenAI’s GPT-5 reasoning stack ignores temperature entirely. Choosing a midrange default (1.0) means we are “close to max randomness” on providers that allow it, while deterministic providers simply clamp or drop the value. That is easier to reason about than trying to chase each vendor’s recommended starting point.
* **The slider is opt-in.** `PoetiqSolver.tsx` lets you drop down to 0.2 if you want conservative behavior, or push beyond 1.0 (up to 2) when targeting Grok or Gemini. The backend (`poetiqController.ts`) passes through what you pick.

In short, the 1.0 default is intentional: Poetiq relies on randomness for breadth but still enforces correctness via training-set gating and majority voting.

## 3. Provider capability cheat sheet

| Provider / model family (per `server/config/models.ts`) | `supportsTemperature` | Practical range | Top-p handling | Notes |
| --- | --- | --- | --- | --- |
| **OpenAI GPT-5 reasoning** (`gpt-5`, `gpt-5-mini`, etc.) | `false` | Ignored – OpenAI doesn’t expose the slider on Responses API | `openai/payloadBuilder.ts` forces `top_p = 1` only for chat variants that allow both knobs | LiteLLM silently drops `temperature`; we pass `reasoning_effort`, `verbosity`, and `reasoning_summary` instead (see `poetiq_wrapper.py` and `arc_agi/llm.py`). |
| **Gemini 3 / 2.5** (direct `gemini/*`) | `true` | 0–2, but Google clamps top-p to **0.95** by default | We leave `top_p` unset so Gemini’s managed default applies | LiteLLM applies `thinking` budgets for pro-tier models; high temperature balances deterministic search heuristics. |
| **Grok 4 family** (`grok-4`, `grok-4-fast-*`) | `true` | 0–2 | xAI honors whatever we send; no top-p override needed | Good target when you want to experiment with >1.0 temperatures because Grok exposes the full range. |
| **Anthropic Claude 4.x** | `true` but Anthropic caps values at **1.0** | 0–1 | Top-p fixed at 1.0 | LiteLLM populates the `thinking` block (see `props` map in `arc_agi/llm.py`). Values above 1 get truncated server-side. |
| **OpenRouter mirrored models** | Mirrors upstream setting (e.g., `openrouter/google/gemini-3-pro-preview` inherits Gemini defaults) | Depends on provider | Depends on provider | Because LiteLLM routes through OpenRouter’s schema, unsupported combinations are rejected early and surfaced via Poetiq’s retry log. |

> 🔎 **Where these facts live:** Capability flags live in `server/config/models.ts`, OpenAI-specific trimming happens in `server/services/openai/payloadBuilder.ts`, and the provider overrides (`limiters` + `props`) live in `poetiq-solver/arc_agi/llm.py`.

## 4. Comparing apples to apples

* **Temperature vs. top-p.** OpenAI sets `top_p = 1` on GPT-5 chat models whenever we _are_ allowed to send temperature (see `buildResponsesPayload`), so randomness is controlled almost entirely by the temperature knob. Gemini does the opposite: `top_p = 0.95` and temperature is a secondary tweak. Because we do not override top-p, each provider’s default “shape” remains intact.
* **Clamping vs. overrides.** When a provider ignores temperature, you still see `temperature: 1.0` echoed in the config metadata that Poetiq stores, but it simply means “requested 1.0, provider used its own lock-step behavior.” This is expected and is why we record both the requested config and the providerRawResponse so audits can compare them.
* **Retries hide capability mismatches.** If you crank temperature past what a vendor accepts, LiteLLM throws an error, Poetiq logs “Ignoring BadRequest … retrying attempt #,” and the iteration proceeds with the clamped value. That’s why you can safely leave the slider at 1.0 and mix providers.

## 5. How to change it (UI & API)

* **UI:** In Poetiq Solver, use the “Temp” input next to “Max Iter.” Values are persisted per session (see `sessionStorage` logic in `PoetiqSolver.tsx`) and travel with community auto-start links.
* **API:** `POST /api/poetiq/solve/:taskId` accepts a JSON body like:

```json
{
  "model": "openrouter/google/gemini-3-pro-preview",
  "numExperts": 8,
  "maxIterations": 10,
  "temperature": 0.7
}
```

If omitted, the backend defaults to 1.0 before invoking the Python bridge (`poetiqController.ts`, `poetiqService.ts`). The resulting stored explanation always records the resolved model, expert count, and effective temperature so you can audit runs later.

---

**Takeaway:** The Poetiq meta-system is LLM-agnostic because every run flows through LiteLLM with standardized config structs. A higher default temperature is deliberate: it drives expert diversity while correctness is still validated deterministically. Adjust the slider when you need to, but you don’t need to babysit per-provider quirks—those are handled in the adapters.
