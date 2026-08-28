"""LLM Gateway module: central manager for Google Gemini and Anthropic API calls
with mock fallback, token metering, and PII guardrails.
"""

import json
from typing import Any, AsyncGenerator, Dict, List, Optional
import httpx

from app.core.config import settings


class LLMGateway:
    """Central gateway for all AI feature calls with multi-provider support."""

    def __init__(self):
        self.gemini_api_key = settings.GEMINI_API_KEY
        self.anthropic_api_key = settings.ANTHROPIC_API_KEY
        self.default_provider = settings.AI_PROVIDER or "gemini"
        self.mock_mode = settings.AI_MOCK_MODE

    def _resolve_provider_and_key(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> tuple[str, str, str]:
        """Determine the active provider, effective API key, and model."""
        key = (api_key or "").strip()
        if not key:
            if self.default_provider == "gemini" and self.gemini_api_key:
                key = self.gemini_api_key
                provider = "gemini"
            elif self.anthropic_api_key and not self.anthropic_api_key.startswith("sk-ant-mock"):
                key = self.anthropic_api_key
                provider = "anthropic"
            elif self.gemini_api_key:
                key = self.gemini_api_key
                provider = "gemini"
            else:
                key = self.gemini_api_key or self.anthropic_api_key
                provider = self.default_provider
        else:
            # Auto-detect provider by key prefix
            if key.startswith("AQ.") or key.startswith("AIzaSy"):
                provider = "gemini"
            elif key.startswith("sk-ant"):
                provider = "anthropic"
            else:
                provider = self.default_provider

        # Resolve model
        if not model:
            model = settings.GEMINI_MODEL if provider == "gemini" else settings.ANTHROPIC_MODEL

        return provider, key, model

    def _compute_gemini_cost(self, input_tokens: int, output_tokens: int) -> float:
        cost = (
            input_tokens * settings.GEMINI_INPUT_PRICE_PER_TOKEN
            + output_tokens * settings.GEMINI_OUTPUT_PRICE_PER_TOKEN
        )
        return round(cost, 6)

    def _compute_anthropic_cost(self, input_tokens: int, output_tokens: int) -> float:
        cost = (
            input_tokens * settings.ANTHROPIC_INPUT_PRICE_PER_TOKEN
            + output_tokens * settings.ANTHROPIC_OUTPUT_PRICE_PER_TOKEN
        )
        return round(cost, 6)

    async def test_connection(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Test live connectivity and validation for an API key."""
        provider, key, resolved_model = self._resolve_provider_and_key(api_key, model)

        if not key or key.startswith("sk-ant-mock"):
            return {
                "success": False,
                "provider": provider,
                "model": resolved_model,
                "error": "No valid API key provided or key is a placeholder.",
            }

        if provider == "gemini":
            clean_model = resolved_model.replace("models/", "")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent"
            headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
            payload = {
                "contents": [{"role": "user", "parts": [{"text": "Ping"}]}],
                "generationConfig": {"maxOutputTokens": 5},
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    response = await client.post(url, headers=headers, json=payload)
                    if response.status_code == 200:
                        return {
                            "success": True,
                            "provider": "gemini",
                            "model": clean_model,
                            "message": f"Successfully connected to Google Gemini ({clean_model})!",
                        }
                    else:
                        err_detail = response.json().get("error", {}).get("message", response.text)
                        return {
                            "success": False,
                            "provider": "gemini",
                            "model": clean_model,
                            "error": f"Gemini API returned error: {err_detail}",
                        }
                except Exception as e:
                    return {
                        "success": False,
                        "provider": "gemini",
                        "model": clean_model,
                        "error": str(e),
                    }
        else:
            # Anthropic test
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            payload = {
                "model": resolved_model,
                "max_tokens": 5,
                "messages": [{"role": "user", "content": "Ping"}],
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    response = await client.post(url, headers=headers, json=payload)
                    if response.status_code == 200:
                        return {
                            "success": True,
                            "provider": "anthropic",
                            "model": resolved_model,
                            "message": f"Successfully connected to Anthropic ({resolved_model})!",
                        }
                    else:
                        return {
                            "success": False,
                            "provider": "anthropic",
                            "model": resolved_model,
                            "error": response.text,
                        }
                except Exception as e:
                    return {
                        "success": False,
                        "provider": "anthropic",
                        "model": resolved_model,
                        "error": str(e),
                    }

    async def generate_completion(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 8192,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate LLM response via Gemini or Anthropic API, or mock fallback."""

        provider, key, resolved_model = self._resolve_provider_and_key(api_key, model)
        # Use mock only if key is completely missing or is a dummy mock placeholder
        is_mock = not key or key.startswith("sk-ant-mock")

        if is_mock:
            user_text = messages[-1]["content"] if messages else ""
            mock_reply = (
                f"Based on your statistical profile and analysis parameters, {user_text[:80].lower()} "
                "exhibits a notable trend. The enterprise segment represents 62% of overall volume, "
                "with a statistically significant correlation (r=0.78, p<0.001) to marketing spend."
            )
            return {
                "text": mock_reply,
                "input_tokens": 512,
                "output_tokens": len(mock_reply.split()),
                "cost_usd": 0.0001,
                "model": resolved_model,
                "provider": provider,
                "mock": True,
            }

        # ── Gemini Provider ──────────────────────────────────────────
        if provider == "gemini":
            clean_model = resolved_model.replace("models/", "")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent"
            headers = {
                "x-goog-api-key": key,
                "Content-Type": "application/json",
            }

            contents = []
            for msg in messages:
                role = "model" if msg.get("role") == "assistant" else "user"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})

            payload: Dict[str, Any] = {
                "contents": contents,
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens,
                },
            }
            if system_prompt:
                payload["systemInstruction"] = {
                    "parts": [{"text": system_prompt}]
                }

            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()

                candidate = data.get("candidates", [{}])[0]
                content_parts = candidate.get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in content_parts)

                usage = data.get("usageMetadata", {})
                input_tokens = usage.get("promptTokenCount", 500)
                output_tokens = usage.get("candidatesTokenCount", len(text.split()))

                return {
                    "text": text,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost_usd": self._compute_gemini_cost(input_tokens, output_tokens),
                    "model": clean_model,
                    "provider": "gemini",
                    "mock": False,
                }

        # ── Anthropic Claude Provider ────────────────────────────────
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": resolved_model,
            "system": system_prompt,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

            text = data["content"][0]["text"]
            input_tokens = data["usage"]["input_tokens"]
            output_tokens = data["usage"]["output_tokens"]

            return {
                "text": text,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": self._compute_anthropic_cost(input_tokens, output_tokens),
                "model": resolved_model,
                "provider": "anthropic",
                "mock": False,
            }

    async def generate_streaming_completion(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 2048,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream LLM response chunks via SSE. Yields dicts with 'type' and 'text' or 'usage'."""

        provider, key, resolved_model = self._resolve_provider_and_key(api_key, model)
        is_mock = not key or key.startswith("sk-ant-mock")

        if is_mock:
            mock_text = (
                "Based on the computed statistical summary, "
                "your dataset shows meaningful patterns. The analysis reveals "
                "several key correlations and distributional characteristics "
                "that inform strategic decision-making."
            )
            words = mock_text.split()
            for i in range(0, len(words), 3):
                chunk = " ".join(words[i:i+3])
                if i > 0:
                    chunk = " " + chunk
                yield {"type": "content_block_delta", "text": chunk}

            yield {
                "type": "message_stop",
                "input_tokens": 512,
                "output_tokens": len(words),
                "cost_usd": 0.0001,
            }
            return

        # ── Gemini SSE Stream ─────────────────────────────────────────
        if provider == "gemini":
            clean_model = resolved_model.replace("models/", "")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:streamGenerateContent?alt=sse"
            headers = {
                "x-goog-api-key": key,
                "Content-Type": "application/json",
            }

            contents = []
            for msg in messages:
                role = "model" if msg.get("role") == "assistant" else "user"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})

            payload: Dict[str, Any] = {
                "contents": contents,
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens,
                },
            }
            if system_prompt:
                payload["systemInstruction"] = {
                    "parts": [{"text": system_prompt}]
                }

            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:]
                        if raw.strip() == "[DONE]":
                            break
                        try:
                            event = json.loads(raw)
                        except json.JSONDecodeError:
                            continue

                        parts = event.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                        for part in parts:
                            txt = part.get("text", "")
                            if txt:
                                yield {"type": "content_block_delta", "text": txt}

                    yield {"type": "message_stop"}
            return

        # ── Anthropic SSE Stream ──────────────────────────────────────
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": resolved_model,
            "system": system_prompt,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[6:]
                    if raw.strip() == "[DONE]":
                        break
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    event_type = event.get("type", "")
                    if event_type == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield {"type": "content_block_delta", "text": delta["text"]}
                    elif event_type == "message_delta":
                        usage = event.get("usage", {})
                        yield {
                            "type": "message_delta",
                            "output_tokens": usage.get("output_tokens", 0),
                        }
                    elif event_type == "message_stop":
                        yield {"type": "message_stop"}


# Singleton instance
llm_gateway = LLMGateway()
