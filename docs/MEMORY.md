# Memory.md - Registro de Problemas Recurrentes y Soluciones

## 📝 Formato

```
[TYPE]: ISSUE | FIX | COUNT
```

**Tipos:**
- `BUG` - Errores de código/funcionalidad
- `PERF` - Problemas de performance
- `DOCS` - Documentación faltante
- `TEST` - Gaps en tests
- `INFRA` - Issues de infraestructura
- `SEC` - Seguridad

---

## 🐛 Issues Recurrentes

### BUG: Context overflow en sesiones largas
- **Issue:** `Context length exceeded` cuando sesiones >50 mensajes
- **Fix:** Implementar auto-compaction a 80% del límite del modelo
- **Count:** 5 ocurrencias
- **Status:** 🔄 En progreso (Fase 1)
- **Related:** docs/TODO.md#context-overflow

### BUG: Tool validation falla con modelos antiguos
- **Issue:** `Missing required property` en tool calls de GPT-3.5
- **Fix:** Usar `strict: false` y validación leniente por defecto
- **Count:** 12 ocurrencias
- **Status:** ✅ Solucionado (v1.2.0)
- **PR:** #45

### PERF: Build lento en desarrollo
- **Issue:** `npm run build` tarda 35s en cold build completo
- **Fix:** Mejorar caching, reducir dependencias innecesarias
- **Count:** 3 ocurrencias reportadas
- **Status:** 🔄 En seguimiento
- **Target:** <25s cold build

### DOCS: Documentación de extensiones incompleta
- **Issue:** Developers no saben cómo crear custom extensions
- **Fix:** Agregar ejemplos en `/examples/extensions/`
- **Count:** 8 queries en Discord
- **Status:** ✅ Planificado (Fase 6)
- **Related:** docs/extensions.md

### TEST: Falta coverage en `src/providers/`
- **Issue:** 45% coverage, crítico en providers
- **Fix:** Agregar tests para Azure, Bedrock, custom providers
- **Count:** 3 code reviews señalaron gap
- **Status:** 🔄 En progreso (Fase 2)
- **Target:** >80% coverage

### BUG: Race condition en streaming JSON
- **Issue:** `Unexpected token` al parsear tool args en streaming
- **Fix:** Buffer acumulativo, parseo diferido hasta `toolcall_end`
- **Count:** 7 ocurrencias
- **Status:** ✅ Solucionado (v1.3.0)
- **PR:** #67

### INFRA: Dependencias desactualizadas
- **Issue:** Alertas Dependabot, vulnerabilidades menores
- **Fix:** Renovar typebox, tinyexec, chai
- **Count:** 5 dependencias
- **Status:** 🟡 Pendiente
- **Risk:** Medio

### BUG: OAuth token expira durante sesiones largas
- **Issue:** Token Anthropic expira después de 30min
- **Fix:** Auto-refresh usando `refreshOAuthToken()`
- **Count:** 4 reportes
- **Status:** ✅ Solucionado (v1.4.0)
- **PR:** #89

### PERF: Búsqueda en logs lenta
- **Issue:** `grep log.jsonl` tarda >2s en sesiones grandes
- **Fix:** Indexar por timestamp, usar binary search
- **Count:** 6 reportes de performance
- **Status:** 🔄 Investigando
- **Impact:** UX en sesiones >1000 mensajes

### SEC: Prompt injection via tool results
- **Issue:** Malicious content en tool results podría inyectar instrucciones
- **Fix:** Sanitizar outputs, validar formato tool messages
- **Count:** 2 reportes teóricos
- **Status:** 🔴 Prioridad alta
- **Risk:** Alto (crítico en producción)

---

## 📊 Statistics

| Type | Count | Fixed | In Progress | Pending |
|------|-------|-------|-------------|---------|
| BUG | 6 | 3 | 2 | 1 |
| PERF | 2 | 0 | 2 | 0 |
| DOCS | 1 | 0 | 0 | 1 |
| TEST | 1 | 0 | 1 | 0 |
| INFRA | 1 | 0 | 0 | 1 |
| SEC | 1 | 0 | 0 | 1 |
| **Total** | **12** | **3** | **5** | **4** |

**Fix Rate:** 25%  
**MTTR (Mean Time To Resolve):** 4 días

---

## 🔍 Recent Additions

### 2026-05-06
- **[INFRA]:** Configuración docs/PROJECT_STATE.md | Crear plantilla estándar | 1
- **[INFRA]:** Configuración docs/TODO.md | Crear plantilla priorizada | 1
- **[INFRA]:** Configuración docs/AGENT_PROFILE.md | Documentar modos fallo | 1
- **[INFRA]:** Configuración docs/AGENT_METRICS.md | Trackear KPIs | 1
- **[INFRA]:** Inicializar docs/MEMORY.md | Registro issues | 1

### 2026-05-05
- **[BUG]:** Streaming JSON race condition | Buffer acumulativo | 7

### 2026-05-01
- **[BUG]:** OAuth token expiry | Auto-refresh implementado | 4

### 2026-04-28
- **[BUG]:** Tool validation strict | Lenient mode por defecto | 12

---

## 🎯 Trending Topics

### Hot (últimos 7 días)
1. Context overflow - 5 ocurrencias
2. Build performance - 3 reportes
3. Extension docs - 8 queries

### Warm (últimos 30 días)
1. Streaming JSON issues - 7 ocurrencias
2. OAuth refresh - 4 ocurrencias
3. Coverage gaps - 3 reviews

### Cold (últimos 90 días)
1. OAuth token expiry - solucionado
2. Tool validation strict - solucionado

---

## 🔄 Prevention Strategies

### Automáticas
- **Pre-commit hooks:** Validar formato memory
- **CI checks:** Detectar issues recurrentes no resueltos
- **Auto-categorización:** ML para clasificar nuevos issues
- **Alertas:** Notificar si COUNT > 10 para un tipo

### Manuales
- **Revisión semanal:** Actualizar contadores
- **Retrospectivas:** Analizar patrones cada 2 semanas
- **Documentación:** Vincular cada fix a memoria

---

## 📈 Evolution

### Month-over-Month

```
Abr 2026: 8 issues (3 fixed)
May 2026: 4 issues nuevos (1 fixed)

Fix rate: +8% ↗️
New issues: -50% ↘️ (mejorando)
```

### Category Trends

```
BUG:     ▬▬▬▬▬▬▬ 6 issues ↓
PERF:    ▬▬ 2 issues →
DOCS:    ▬ 1 issue →
TEST:    ▬ 1 issue →
INFRA:   ▬ 1 issue →
SEC:     ▬ 1 issue →
```

---

## 🎓 Learnings

1. **Streaming JSON:** Buffering es crítico para integridad
2. **OAuth:** Siempre implementar auto-refresh desde el inicio
3. **Context:** Hard limits + compaction preventiva = UX suave
4. **Tool validation:** Modo estricto solo para desarrollo
5. **Performance:** Monitorear desde el día 1

---

## 🔗 Related

- [docs/AGENT_PROFILE.md](AGENT_PROFILE.md) - Modos de fallo detallados
- [docs/TODO.md](TODO.md) - Tareas de mitigación
- [docs/PROJECT_STATE.md](PROJECT_STATE.md) - Estado actual

---

**Mantenimiento:** Actualizar semanalmente  
**Última actualización:** 2026-05-06  
**Próxima revisión:** 2026-05-13
