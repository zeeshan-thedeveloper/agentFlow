# API Key Management — Research & Design Decisions

## Context

Our platform lets users run agentic AI workflows using models from OpenAI, Anthropic (Claude), and potentially others. Since we don't host our own models, users bring their own API keys (BYOK — Bring Your Own Key). This doc captures how that pattern works and what we need to build.

---

## How n8n Does It (Reference Model)

In n8n, users go to **Settings > Credentials**, paste their API key (OpenAI, Anthropic, etc.), and n8n stores it encrypted in its own database. Every workflow node that calls an AI model references a credential by name. The key is only used server-side at runtime — never exposed to the frontend.

**Flow:**
```
User pastes API key → n8n encrypts & stores in DB
→ Workflow runs → n8n decrypts key at runtime → calls OpenAI/Claude API
```

Similar tools that follow the same pattern: Flowise, LangFlow, Dify, OpenRouter.

---

## BYOK Flow for Our Platform

### 1. User Onboarding (Settings Page)
- User navigates to Settings > API Keys (or Integrations)
- Pastes their OpenAI / Anthropic / other provider key
- Backend receives it, encrypts it, stores encrypted blob in DB
- UI shows only masked key (e.g., `sk-...Ab3X`) to confirm it's saved

### 2. Runtime (When an Agent Runs)
```
Agent workflow triggers
→ Backend fetches encrypted key from DB for that user
→ Decrypts in memory (never logged)
→ Makes API call to OpenAI/Claude using that key
→ User gets billed on their own provider account
```

The key never touches the frontend during execution.

### 3. Key Deletion
- User can revoke/delete keys from Settings
- We delete from DB — we never need to show the full key again

---

## Storage Options

| Option | Notes |
|--------|-------|
| **AWS Secrets Manager / Azure Key Vault** | Best for production — encryption, RBAC, audit logs |
| **Encrypt in DB (AES-256)** | Simpler for early stage — master key lives in env var, NOT in DB |
| **HashiCorp Vault** | Good for multi-cloud or compliance-heavy scenarios |

**Recommended for our stage:** AES-256 encryption in DB, master encryption key stored in environment variable (or a secrets manager env var). Upgrade to a managed secrets service when scaling.

---

## Security Rules (Non-Negotiable)

- **Never** store plaintext API keys in the database
- **Never** send API keys to the frontend — not even in API responses
- **Never** log API keys (mask them in any logs)
- Master encryption key must live in an environment variable / secrets manager, **not** in the database
- Only show the last 4 characters of the key in the UI (`sk-...Ab3X`)
- Apply least-privilege — only the agent execution service should be able to decrypt keys

---

## Encryption Pattern (AES-256)

```
// Storing a key
const encrypted = aes256.encrypt(MASTER_KEY, userApiKey);
db.save({ userId, provider: 'openai', encryptedKey: encrypted });

// Using a key at runtime
const encrypted = db.get({ userId, provider: 'openai' });
const apiKey = aes256.decrypt(MASTER_KEY, encrypted);
// use apiKey for the API call, then discard from memory
```

`MASTER_KEY` = pulled from environment variable (e.g., `API_KEY_ENCRYPTION_SECRET`).

---

## Per-Provider Setup

Each provider key is stored separately, tied to `userId + provider`:

| Provider | Key Format | Docs |
|----------|-----------|------|
| OpenAI | `sk-...` | [OpenAI API Keys](https://platform.openai.com/api-keys) |
| Anthropic (Claude) | `sk-ant-...` | [Anthropic Console](https://console.anthropic.com/settings/keys) |

---

## Policy Notes

- **OpenAI explicitly allows** BYOK for third-party apps — users own their usage and billing
- **Anthropic** follows the same model
- We act as a proxy that uses their credentials on their behalf — legally fine, but must be transparent in ToS

---

## What to Build (Implementation Checklist)

- [ ] Settings page — add/remove API keys per provider
- [ ] Backend endpoint to receive and encrypt keys on save
- [ ] Per-user encrypted key store in DB (`user_api_keys` table: userId, provider, encryptedKey, maskedKey, createdAt)
- [ ] Key decryption service (used only by agent execution engine)
- [ ] Runtime key injection into model calls
- [ ] Key validation on save (test call to provider before storing)
- [ ] Masked key display in UI

---

## References

- [Anthropic credentials | n8n Docs](https://docs.n8n.io/integrations/builtin/credentials/anthropic/)
- [OpenAI credentials | n8n Docs](https://docs.n8n.io/integrations/builtin/credentials/openai/)
- [OpenAI BYOK policy discussion](https://community.openai.com/t/openais-bring-your-own-key-policy/14538)
- [BYOK on OpenRouter](https://openrouter.ai/docs/guides/overview/auth/byok)
- [Secure API Key Storage — Medium](https://medium.com/@sassenthusiast/serverless-strategies-with-openai-episode-1-secure-api-key-storage-and-access-00c91b74bc2a)
- [OpenAI API Key Safety Best Practices](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
