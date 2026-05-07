# Estado Actual del Proyecto

## Fecha: 2026-05-07

---

## 📌 Resumen del Proyecto

**Pi Monorepo** - Ecosistema de agentes AI para desarrollo de software con múltiples paquetes:
- `@mariozechner/pi-ai` - API unificada LLM con soporte multi-proveedor y tool calling
- `@mariozechner/pi-agent-core` - Framework de agente con estado, ejecución de herramientas y streaming
- `@mariozechner/pi-coding-agent` - CLI interactivo para coding con TUI, sesiones, extensiones
- `@mariozechner/pi-mom` - Slack bot auto-gestionado con sandbox Docker
- `@mariozechner/pi-tui` - Framework TUI terminal con renderizado diferencial

---

## ✅ Qué Funciona

### Core Infrastructure
- ✅ Monorepo configurado con npm workspaces
- ✅ TypeScript configurado y compilación funcional
- ✅ Paquete `pi-ai`: Soporte completo para múltiples proveedores (OpenAI, Anthropic, Google, etc.)
- ✅ Tool calling y function calling implementado con streaming
- ✅ Context serialization/deserialization funcional
- ✅ Cross-provider handoffs (transformación de mensajes entre modelos)
- ✅ Sistema de autenticación OAuth y API keys
- ✅ Prompt caching configurable

### Agent Framework
- ✅ `pi-agent-core`: Event loop completo con estados
- ✅ Ejecución paralela y secuencial de herramientas
- ✅ Hooks `beforeToolCall` y `afterToolCall`
- ✅ Steering y follow-up queues
- ✅ Soporte para custom message types

### Coding Agent CLI
- ✅ Modo interactivo con editor TUI
- ✅ Gestión de sesiones con tree branching
- ✅ Sistema de extensiones (registerTool, registerCommand)
- ✅ Skills system con SKILL.md discovery
- ✅ Prompt templates
- ✅ Package system (pi-packages via npm/git)
- ✅ Comandos slash (/tree, /fork, /compact, etc.)

### TUI Framework
- ✅ Renderizado diferencial (3 estrategias)
- ✅ Output sincronizado CSI 2026 (sin flicker)
- ✅ Componentes: Editor, Markdown, SelectList, Input, etc.
- ✅ Autocomplete (slash commands, file paths)
- ✅ Soporte IME para CJK input
- ✅ Inline images (Kitty/iTerm2 protocols)

### Mom Slack Bot
- ✅ Integración Socket Mode
- ✅ Sandbox Docker y modo host
- ✅ Self-management de herramientas
- ✅ Event system (immediate, one-shot, periodic)
- ✅ Skills system y autoinstalación

### Testing & QA
- ✅ Vitest configurado
- ✅ Test runner con/sin API keys
- ✅ Faux provider para testing
- ✅ Coverage básico

---

## ⚠️ Limitaciones Conocidas

### Funcionales
- **Context overflow**: Compaction automática puede perder información relevante en sesiones largas
- **Cross-provider**: Transformación de thinking blocks puede perder contexto de razonamiento
- **OAuth**: Algunos flujos requieren CLI manual inicial
- **Browser**: Soporte limitado (no Bedrock, no OAuth)

### Técnicas
- **Type Safety**: Algunas validaciones de tipos en opciones provider-specific no son exhaustivas
- **Error Handling**: Mensajes de error de proveedores a veces no son parseados consistentemente
- **Streaming**: Google provider no soporta streaming de tool calls (delta events)
- **Rate Limits**: No hay backoff automático configurado

---

## 🔧 Technical Debt

### Alta Prioridad
- Documentación de código inconsistente en algunos módulos
- Refactor potencial en `src/providers/` para reducir duplicación
- Tests de integración cross-package limitados

### Media Prioridad  
- Optimización de `src/context.ts` (búsqueda en logs puede ser lenta)
- Mejoras en `src/compaction.ts` (estrategias más inteligentes)
- Cache de prompts más granular

### Baja Prioridad
- Refactor de tests para mejorar mantenibilidad
- Agregar más ejemplos de integración
- Mejoras en temas y UI personalizable

---

## 🚀 Cambios Recientes

### Últimas Actualizaciones
- **Security**: Implementada sanitización de outputs de herramientas (P0-001 fix)
- Implementación completa de cross-provider handoffs
- Mejoras en TUI differential rendering
- Nuevo sistema de OAuth unificado
- Soporte extendido para models con reasoning

---

## 📊 Arquitectura

```
pi-ai (LLM API) → pi-agent-core (Agent) → pi-coding-agent (CLI)
                    ↓
                  pi-tui (UI)
                    ↓
                  pi-mom (Slack)
```

**Flujo de Datos:**
1. User input → AgentMessage[]
2. transformContext() → filtrado/compactación
3. convertToLlm() → Message[] (LLM format)
4. Provider stream → tool calls / text
5. Tool execution → tool results
6. Update context → continue / loop

---

## 🧪 Testing Status

| Paquete | Tests | Status |
|---------|-------|--------|
| pi-ai | ✓ | Funcional |
| pi-agent-core | ✓ | Funcional |
| pi-coding-agent | ✓ | Funcional |
| pi-tui | ✓ | Funcional |
| pi-mom | ✓ | Funcional |

---

## 🎯 Próximos Pasos (TODO.md)

Ver `docs/TODO.md` para lista priorizada de tareas técnicas.

---

**Mantenido por**: Auto-actualizable
**Última revisión**: 2026-05-06
