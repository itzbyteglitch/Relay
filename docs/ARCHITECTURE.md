# Relay Architecture

## Overview

Relay is a proxy that lets Claude Code route through arbitrary LLM providers. It consists of:

- **Server**: Cloudflare Worker (TypeScript, Hono) — hosted globally, free tier
- **Client**: Python CLI (`uv` installable) — runs locally, manages device auth and provider config

## System Diagram

```
┌─────────────┐     HTTPS      ┌──────────────────┐     HTTPS      ┌─────────────────┐
│  Developer  │ ─────────────► │  Relay Server    │ ─────────────► │  LLM Providers  │
│  (local)    │                │  (Cloudflare     │                │  (NVIDIA,       │
│             │                │   Workers)       │                │   Gemini,       │
│  relay claude              │                  │                │   OpenCode,     │
│  relay setup               │  KV Storage:     │                │   Requesty,     │
│  relay provider            │  - Devices       │                │   Cerebras)     │
└─────────────┘                │  - Providers     │                └─────────────────┘
                               │  - Secrets       │
                               └──────────────────┘
```

## Data Flow

1. **Setup** (`relay setup`):
   - User provides server URL, device password, device name
   - Client generates UUID, calls `POST /auth/register`
   - Server verifies password (PBKDF2 hash in KV), creates HMAC-SHA256 device token
   - Token hash stored in KV (`device:<uuid>`), raw token returned once
   - Client stores token in OS keyring (fallback: AES-GCM in config.json)

2. **Claude Code Launch** (`relay claude`):
   - Client reads config + token fresh each invocation
   - Sets env vars: `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`
   - Execs `claude` (real `os.execvpe`, signals pass through)

3. **Model Discovery** (`GET /v1/models`):
   - Claude Code calls `/v1/models` with `Authorization: Bearer <device_token>`
   - Server verifies token (HMAC), checks device not revoked
   - Aggregates models from all enabled providers (live fetch with static fallback)
   - Returns Anthropic-compatible models list

4. **Message Proxy** (`POST /v1/messages`):
   - Claude Code sends Anthropic Messages API request
   - Server resolves model prefix → provider → transport
   - **Anthropic transport** (Requesty): passes through, swaps auth header
   - **OpenAI transport** (NVIDIA, Gemini, OpenCode, Cerebras): converts request/response, streams SSE
   - Returns Anthropic-formatted response/SSE

## Authentication

| Component | Mechanism |
|-----------|-----------|
| Device registration | Shared password (PBKDF2-SHA256, 100k iter) → HMAC-SHA256 token |
| Device token | `device_uuid.issued_at.signature`, verified via `crypto.subtle.verify` |
| Admin routes | Separate admin password → short-lived admin token (distinct KV prefix) |
| Provider keys | Stored in KV (`provider_key:<name>`), never returned by GET routes |

## Key Design Decisions

1. **Two transports only** — avoids per-provider code; catalog is data
2. **KV-backed provider keys** — `relay provider add` works without redeploy
3. **HMAC tokens** — stateless verification, revocable via KV flag
4. **PBKDF2 via Web Crypto** — native in Workers, no WASM dependency
5. **Real exec** — `os.execvpe` passes signals/exit codes correctly
6. **No local daemon** — unlike local proxies, Relay is cloud-hosted

## Security

- Passwords: PBKDF2-SHA256 (100k), unique 16-byte salt, stored as `salt:iterations:hash`
- Tokens: HMAC-SHA256 over `device_uuid.issued_at`, secret server-side only
- Device tokens: hashed in KV, never logged
- Provider keys: write-only via admin routes, masked in list responses
- Rate limiting: 5 requests/hour per IP on `/auth/register`
- No secrets in logs, tests, or committed files