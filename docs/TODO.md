# TODO.md - Lista Priorizada de Tareas Técnicas

## 📋 Metodología

Priorización basada en modelo **Riesgo/Costo/Impacto**:
- **Alta**: Bloqueadores, seguridad, core functionality
- **Media**: Mejoras, refactors, documentación
- **Baja**: Nice-to-have, optimizaciones

---

## 🔴 Alta Prioridad

### [CRÍTICO] Core Infrastructure
- [ ] ✅ Crear `AGENT_PROFILE.md` - Patrones de fallo y errores recurrentes
- [ ] ✅ Crear `AGENT_METRICS.md` - Trackeo de iteraciones, fallos, rollbacks
- [ ] ✅ Inicializar `MEMORY.md` - Registro de problemas recurrentes (formato: `[TYPE]: ISSUE | FIX | COUNT`)
- [ ] ✅ Configurar entorno dev completo - `npm install`, `build`, `check`

### [HIGH] Paquete AI
- [ ] ✅ Validar tool calling - Argument validation, streaming
- [ ] ✅ Test cross-provider handoffs - Transformación mensajes
- [ ] ✅ Auditar context serialization - JSON roundtrip tests
- [ ] ✅ Test suite completo - stream, tokens, abort, handoff

### [HIGH] Paquete Agent Core  
- [ ] ✅ Validar tool execution modes - Parallel vs Sequential
- [ ] ✅ Test steering/follow-up queues - one-at-a-time vs all
- [ ] ✅ Error handling y recovery - Abort, retry logic

### [HIGH] Paquete Coding Agent
- [ ] ✅ Verificar extension system - registerTool, registerCommand
- [ ] ✅ Probar session/tree management - /tree, /fork, compaction
- [ ] ✅ Test interactive mode y editor - TUI integration

---

## 🟡 Media Prioridad

### Paquete AI
- [ ] Implementar tests para Google provider específicos
- [ ] Documentar límites de rate por provider
- [ ] Agregar más faux provider fixtures

### Paquete Agent Core
- [ ] Implementar custom message types - Ejemplos
- [ ] Agregar más métricas de performance
- [ ] Documentar patrones de retry recomendados

### Paquete Coding Agent
- [ ] Probar skills discovery - SKILL.md parsing
- [ ] Test package system - npm/git install
- [ ] Validar prompt templates - Variable expansion

### Paquete TUI
- [ ] Test componentes con edge cases - Very long text, unicode
- [ ] Validar IME positioning - CJK locales
- [ ] Agregar más ejemplos de custom components

### Paquete Mom
- [ ] Security audit - Prompt injection scenarios
- [ ] Test Docker sandbox isolation
- [ ] Validar event system - Cron, one-shot

---

## 🟢 Baja Prioridad

### Documentación
- [ ] Agregar más guías de integración
- [ ] Actualizar changelogs (unreleased sections)
- [ ] Crear ejemplos de pi-packages

### Tests
- [ ] Implementar propiedad-based tests
- [ ] Agregar tests de performance/benchmarks
- [ ] Mejorar coverage report

### UX
- [ ] Temas adicionales
- [ ] Mejoras en keybindings configurables
- [ ] Ejemplos de extensiones avanzadas

---

## 📊 Tracking

**Métricas Actuales:**
- Total tareas: 29
- Completadas: 6 (Fase 1 en progreso)
- Pendientes: 23

**Por Fase:**
- Fase 1: 6/6 (100%) - Setup
- Fase 2: 0/5 (0%) - Core AI  
- Fase 3: 0/5 (0%) - Agent Core
- Fase 4: 0/6 (0%) - Coding Agent
- Fase 5: 0/4 (0%) - Test & QA
- Fase 6: 0/3 (0%) - Extensibilidad

---

## 🔄 Actualización

**Última actualización:** 2026-05-06  
**Siguiente revisión:** Al completar Fase 1  
**Responsable:** AI Agent Assistant
