# Rate Limits by Provider

## 📊 Overview

This document provides current rate limit information for all supported LLM providers. Rates are subject to change - always verify with provider documentation.

**Last Updated**: 2026-05-07

---

## OpenAI

### Models

#### GPT-4o
- **Requests per minute**: 10,000 tokens per minute
- **Requests per day**: Rolling 24-hour window
- **Context window**: 128,000 tokens
- **RPM (Tier 1)**: 300 requests/minute
- **TPM**: 10,000 tokens/minute

#### GPT-4o-mini
- **Requests per minute**: 10,000 tokens per minute
- **Requests per day**: Rolling 24-hour window
- **Context window**: 128,000 tokens
- **RPM (Tier 1)**: 3,000 requests/minute
- **TPM**: 30,000 tokens/minute

#### GPT-4
- **Requests per minute**: 10,000 tokens per minute
- **Requests per day**: 10,000 requests per day
- **Context window**: 8,192 tokens
- **RPM (Tier 1)**: 200 requests/minute
- **TPM**: 40,000 tokens/minute

### Error Handling

```typescript
// Rate limit response
{
  error: {
    message: "Rate limit reached",
    type: "insufficient_quota",
    param: null,
    code: "insufficient_quota"
  }
}
```

**Mitigation**: Exponential backoff with jitter

---

## Anthropic

### Claude 3.5 Series

#### Claude 3.5 Sonnet
- **Requests per minute**: 40 RPM
- **Tokens per minute**: 400,000 TPM
- **Context window**: 200,000 tokens
- **Max output**: 8,192 tokens

#### Claude 3.5 Haiku
- **Requests per minute**: 80 RPM
- **Tokens per minute**: 400,000 TPM
- **Context window**: 200,000 tokens
- **Max output**: 8,192 tokens

### Claude 3 Series

#### Claude 3 Opus
- **Requests per minute**: 20 RPM
- **Tokens per minute**: 400,000 TPM
- **Context window**: 200,000 tokens
- **Max output**: 8,192 tokens

#### Claude 3 Sonnet
- **Requests per minute**: 40 RPM
- **Tokens per minute**: 400,000 TPM
- **Context window**: 200,000 tokens
- **Max output**: 8,192 tokens

#### Claude 3 Haiku
- **Requests per minute**: 80 RPM
- **Tokens per minute**: 400,000 TPM
- **Context window**: 200,000 tokens
- **Max output**: 8,192 tokens

### Error Handling

```json
{
  "type": "error",
  "error": {
    "type": "overloaded_error",
    "message": "Overloaded"
  }
}
```

**Status Code**: 529
**Mitigation**: Retry with exponential backoff, fallback to smaller model

---

## Google (Gemini)

### Gemini 1.5 Pro
- **Requests per minute**: 2 RPM (free tier)
- **Tokens per minute**: 1,000,000 TPM (free tier)
- **Context window**: 2,000,000 tokens
- **Paid tier**: Higher limits available

### Gemini 1.5 Flash
- **Requests per minute**: 5 RPM (free tier)
- **Tokens per minute**: 1,000,000 TPM (free tier)
- **Context window**: 1,000,000 tokens
- **Paid tier**: Higher limits available

### Gemini 1.0 Pro
- **Requests per minute**: 60 RPM
- **Tokens per minute**: 1,000,000 TPM (free tier)
- **Context window**: 30,000 tokens
- **Paid tier**: Higher limits available

### Error Handling

```json
{
  "error": {
    "code": 429,
    "message": "RESOURCE_EXHAUSTED: Quota exceeded",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```

**Mitigation**: Context compaction, pagination

---

## Mistral

### Mistral Large
- **Requests per minute**: 5 RPM
- **Tokens per minute**: 100,000 TPM
- **Context window**: 32,000 tokens

### Mistral Small
- **Requests per minute**: 10 RPM
- **Tokens per minute**: 100,000 TPM
- **Context window**: 32,000 tokens

### Mixtral 8x7B
- **Requests per minute**: 20 RPM
- **Tokens per minute**: 100,000 TPM
- **Context window**: 32,000 tokens

---

## Local Providers (Ollama)

### No Rate Limits
- **Requests per minute**: Unlimited (hardware dependent)
- **Tokens per minute**: Unlimited (hardware dependent)
- **Context window**: Model dependent (e.g., Llama 2: 4,096)

**Note**: Limited by local hardware capabilities

---

## Best Practices

### 1. Implement Exponential Backoff

```typescript
const options = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true
};

const result = await withRetry(
  () => apiCall(),
  options
);
```

### 2. Rate Limiting

```typescript
// Per-provider rate limiting
const rateLimiters = {
  openai: new RateLimiter({ requests: 300, per: 60000 }),
  anthropic: new RateLimiter({ requests: 40, per: 60000 }),
  google: new RateLimiter({ requests: 2, per: 60000 })
};
```

### 3. Context Management

```typescript
// Auto-compaction at 80% of context window
if (currentTokens > maxTokens * 0.8) {
  await session.compact();
}
```

### 4. Fallback Strategy

```typescript
try {
  return await primaryProvider.generate(prompt);
} catch (error) {
  if (isRateLimitError(error)) {
    return await fallbackProvider.generate(prompt);
  }
  throw error;
}
```

---

## Monitoring

### Key Metrics to Track

1. **Request Rate**: Requests per minute by provider
2. **Token Usage**: Input/output tokens by provider
3. **Error Rate**: Rate limit errors (429)
4. **Latency**: Response times by provider
5. **Cost**: Token costs by provider

### Alerting Thresholds

- **Rate limit errors**: Alert after 3 in 5 minutes
- **Context usage**: Warning at 70%, critical at 90%
- **Cost**: Alert when exceeding budget

---

## Provider Comparison

| Provider | Best For | Rate Limit (RPM) | Context Window | Cost |
|----------|----------|------------------|----------------|------|
| OpenAI GPT-4o | General purpose | 300 | 128K | $$ |
| Anthropic Claude 3.5 | Reasoning | 40 | 200K | $$ |
| Google Gemini | Long context | 2-5 | 2M | $ |
| Mistral | Open source | 5-20 | 32K | $ |
| Local (Ollama) | Privacy | Unlimited | Model dep. | Free |

---

## Emergency Procedures

### Rate Limit Exhausted

1. **Immediate**: Switch to fallback provider
2. **Short-term**: Implement request queuing
3. **Long-term**: Request limit increase from provider

### High Latency

1. **Immediate**: Switch to faster model
2. **Short-term**: Enable caching
3. **Long-term**: Optimize prompts

### Cost Overrun

1. **Immediate**: Stop non-critical requests
2. **Short-term**: Switch to lower-cost provider
3. **Long-term**: Implement cost controls

---

## References

- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [Anthropic Rate Limits](https://docs.anthropic.com/en/api/rate-limits)
- [Google AI Rate Limits](https://ai.google.dev/gemini-api/docs/quotas)
- [Mistral API Limits](https://docs.mistral.ai/)

---

**Note**: Rate limits are subject to change. Always verify current limits with provider documentation.

**Version**: 1.0.0  
**Last Updated**: 2026-05-07