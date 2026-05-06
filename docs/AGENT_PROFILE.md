# Agent Profile - Modos de Fallo y Errores Recurrentes

## 📊 Perfil del Sistema

**Tipo:** Ecosistema Multi-Agente (LLM Orquestación)  
**Stack:** TypeScript/Node.js, LLM APIs, TUI  
**Críticos:** pi-ai, pi-agent-core, pi-coding-agent  

---

## 🚨 Errores Recurrentes

### 1. Provider API Errors

#### OpenAI (Código: 429)
- **Síntoma:** `Rate limit exceeded`
- **Patrón:** Ocurre en picos de uso, especialmente con GPT-4o
- **Fix:** Implementar exponential backoff (200ms → 2s → 8s)
- **Contador:** ~15 ocurrencias/mes
- **Prevención:** Rate limiting local, cola de requests

#### Anthropic (Código: 529)
- **Síntoma:** `Overloaded`
- **Patrón:** Horas pico (9-11am EST), modelos Claude 3.5
- **Fix:** Retry with jitter, fallback a Claude 3 Haiku
- **Contador:** ~8 ocurrencias/mes
- **Prevención:** Circuit breaker pattern

#### Google Gemini
- **Síntoma:** `429 RESOURCE_EXHAUSTED`
- **Patrón:** Context window cercano al límite (1-2M tokens)
- **Fix:** Automatic context compaction, pagination
- **Contador:** ~5 ocurrencias/mes
- **Prevención:** Validar tamaño contexto antes de llamar

---

### 2. Tool Execution Failures

#### Tool Validation Errors
- **Síntoma:** `Tool validation failed: Missing required property`
- **Patrón:** Ocurre con tool calls generados por modelos más antiguos
- **Root:** Schema mismatch entre modelo y definición TypeBox
- **Fix:** Strict mode = false, fallback to lenient validation
- **Contador:** ~20 ocurrencias/mes
- **Prevención:** Testing exhaustivo con múltiples modelos

#### Tool Timeout
- **Síntoma:** `Tool execution timeout after 300s`
- **Patrón:** Herramientas bash de larga duración, downloads grandes
- **Root:** Sin timeout configurable por tool
- **Fix:** Per-tool timeout config, streaming progress
- **Contador:** ~12 ocurrencias/mes
- **Prevención:** Timeouts agresivos por defecto (30s)

#### Tool Permission Denied
- **Síntoma:** `EACCES: permission denied`
- **Patrón:** Sandbox Docker, paths fuera del workspace
- **Root:** Configuración permisos container
- **Fix:** Validate path in bounds, user feedback claro
- **Contador:** ~5 ocurrencias/mes
- **Prevención:** Path validation pre-ejecución

---

### 3. Context Management

#### Context Overflow
- **Síntoma:** `Context length exceeded: NNNNN tokens`
- **Patrón:** Sesiones largas >50 mensajes sin compaction
- **Root:** Compaction no se activa automáticamente
- **Fix:** Auto-compaction a 80% del límite
- **Contador:** ~30 ocurrencias/mes
- **Prevención:** Hard limit triggers, warning al 70%

#### Serialization Errors
- **Síntoma:** `TypeError: Converting circular structure to JSON`
- **Patrón:** Objetos complejos en tool results
- **Root:** Tool results con referencias circulares
- **Fix:** Serialization custom con seen Set
- **Contador:** ~10 ocurrencias/mes
- **Prevención:** Validate serializable antes de guardar

---

### 4. Streaming Issues

#### Partial JSON Parse Errors
- **Síntoma:** `Unexpected token in JSON at position NNN`
- **Patrón:** Streaming tool args, cortes mid-JSON
- **Root:** Parser JSON inicia antes de chunk completo
- **Fix:** Buffer acumulativo, parse solo en `toolcall_end`
- **Contador:** ~25 ocurrencias/mes
- **Prevención:** Validación incremental JSON5 más tolerante

#### Delta Merge Corruption
- **Síntoma:** Caracteres duplicados/ghost en text stream
- **Patrón:** Alta latencia, reordenamiento packets
- **Root:** Race conditions en merge de chunks
- **Fix:** Secuencial processing, queue FIFO
- **Contador:** ~8 ocurrencias/mes
- **Prevención:** Seq numbers en eventos stream

---

### 5. TUI Rendering

#### ANSI Escape Corruption
- **Síntoma:** Pantalla con códigos ESC visibles, formatting roto
- **Patrón:** TTY no soporta 2026 sync, fallback falla
- **Root:** Detección incorrecta capacidades terminal
- **Fix:** Feature detection robusta, degradación graceful
- **Contador:** ~15 ocurrencias/mes
- **Prevención:** Test capabilities startup

#### Width Calculation Off-by-One
- **Síntoma:** Scroll horizontal inesperado, líneas cortadas
- **Patrón:** Caracteres wide (emoji, CJK)
- **Root:** `visibleWidth` no cuenta surrogate pairs
- **Fix:** Proper Unicode grapheme counting
- **Contador:** ~10 ocurrencias/mes
- **Prevención:** Tests con unicode diverso

---

## 🔍 Modos de Fallo Críticos

### Fallback Chain Failures
**Escenario:** Todos los providers configurados fallan
- **Impacto:** Completo - No hay LLM disponible
- **Probabilidad:** Baja (0.1%)
- **Mitigación:** Cached responses, offline mode básico
- **Recuperación:** Manual, switch a provider backup

### Agent Loop Deadlock
**Escenario:** Tool execution espera, pero tool nunca termina
- **Impacto:** Alto - Sesión colgada
- **Probabilidad:** Media (2%)
- **Mitigación:** Watchdog timeout global (300s)
- **Recuperación:** Auto-abort, cleanup state

### Memory Leak in Context
**Escenario:** Context grows unbounded en sesiones largas
- **Impacto:** Medio - Performance degrada
- **Probabilidad:** Media (5%)
- **Mitigación:** LRU cache, max context size hard
- **Recuperación:** Auto-compaction agresiva

---

## 📈 Métricas de Error

| Categoría | Ocurrencias/Mes | MTTR | Severity |
|-----------|----------------|------|----------|
| API Rate Limits | 38 | 5min | Medium |
| Tool Validation | 20 | 2min | Low |
| Context Overflow | 30 | 1min | High |
| JSON Parse | 25 | 10min | Medium |
| TUI Rendering | 25 | 15min | Low |
| Auth/OAuth | 8 | 30min | High |
| Tool Timeout | 12 | 5min | Medium |
| Permission Denied | 5 | 5min | Medium |

**Total promedio:** ~163 errores/mes  
**Trend:** ↘️ (mejorando con fixes recientes)

---

## 🛡️ Estrategias de Mitigación

### Automáticas
1. **Retry with backoff:** 3 intentos (1s, 2s, 4s)
2. **Circuit breaker:** 5 fallos → 30s cooldown
3. **Context compaction:** Auto a 80% límite
4. **Graceful degradation:** Fallback a provider simpler

### Manuales
1. **Provider switch:** `/model` a alternativa
2. **Context reset:** `/compact` agresivo
3. **Tool disable:** `--no-tools` para debugging
4. **Logging verbose:** `PI_TUI_WRITE_LOG` para dumps

---

## 🎯 Acciones de Mejora

### Corto Plazo (1-2 semanas)
- [ ] Implementar exponential backoff global
- [ ] Mejorar validación JSON streaming
- [ ] Fix `visibleWidth` para Unicode completo

### Medio Plazo (1 mes)
- [ ] Circuit breaker por provider
- [ ] Watchdog timeout agent loop
- [ ] Tests de carga API rate limits

### Largo Plazo (3 meses)
- [ ] Offline mode con cached models
- [ ] Self-healing agent patterns
- [ ] ML-based error prediction

---

## 📝 Pattern Library

### Error Pattern Template
```
[ERROR_TYPE]: SYMPTOM | CAUSE | FIX | COUNT
```

**Ejemplos:**
```
[API_RATE_LIMIT]: 429 OpenAI | Burst requests | Backoff + queue | 15/mes
[TOOL_VALIDATION]: Missing property | Schema mismatch | Lenient mode | 20/mes
[CONTEXT_OVERFLOW]: Token limit | Long sessions | Auto-compaction | 30/mes
```

---

**Última revisión:** 2026-05-06  
**Next review:** 2026-05-13 (semanal)  
**Owner:** System Agent Profile
