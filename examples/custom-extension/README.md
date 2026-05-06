# Custom Extension Example - Hello World

Este ejemplo muestra cómo crear una extensión personalizada para pi que agrega herramientas, comandos y UI personalizados.

## 📄 Archivos del Ejemplo

- `hello-world-extension.ts` - Extensión principal
- `package.json` - Configuración del paquete

## 🎯 Qué Incluye

Esta extensión demuestra 4 capacidades principales:

1. **Custom Tool** - Herramienta de saludo personalizable
2. **Custom Command** - Comando `/hello` en la CLI
3. **Event Handler** - Reacción a mensajes
4. **Custom Widget** - Widget en el footer con hora

## 🛠️ Implementación

### 1. Custom Tool (greeting)

```typescript
const greetingTool: Tool = {
  name: "greeting",
  label: "Greeting Tool",
  description: "Generates a personalized greeting message",
  parameters: Type.Object({
    name: Type.String({ description: "Name to greet" }),
    formal: Type.Optional(Type.Boolean({ description: "Use formal greeting"})),
    language: Type.Optional(Type.String({ description: "Language code"})),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    // Lógica de la herramienta
    return {
      content: [{ type: "text", text: greeting }],
      details: { tool: "greeting" }
    };
  }
};

pi.registerTool(greetingTool);
```

### 2. Custom Command (/hello)

```typescript
pi.registerCommand("hello", {
  description: "Send a test greeting",
  handler: async (args, context) => {
    return {
      type: "success",
      message: `Hello ${args[0] || "World"}!`
    };
  }
});
```

### 3. Event Handler

```typescript
pi.on("message", async (event, context) => {
  // React to messages
  if (event.message?.content?.includes("hello")) {
    pi.logger.info("Greeting detected!");
  }
});
```

### 4. Custom Widget

```typescript
pi.registerWidget({
  id: "hello-world-widget",
  position: "footer",
  render: () => `⏰ ${new Date().toLocaleTimeString()}`,
  updateInterval: 1000
});
```

## 🚀 Uso

### Instalación

```bash
# Clonar en tu directorio de extensiones
mkdir -p ~/.pi/agent/extensions/
cp -r hello-world-extension ~/.pi/agent/extensions/

# O instalar vía pi CLI
pi --extension ./examples/custom-extension/hello-world-extension.ts
```

### Comandos Disponibles

```bash
# Usar la herramienta de saludo
/hello [nombre]

# La herramienta estará disponible para el LLM
# Puedes preguntarle que use la herramienta greeting
```

### Ejemplos

```
User: /hello Maria
pi: Hello Maria!

User: Usa la herramienta greeting para saludar a Juan
pi: (Usa la herramienta greeting)
pi: Hello Juan!
```

## 📦 Estructura del Proyecto

```
hello-world-extension/
├── hello-world-extension.ts  # Código principal
├── README.md                 # Documentación
├── package.json              # Configuración npm
└── tsconfig.json            # Configuración TypeScript
```

## 🔧 Configuración TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "lib": ["ES2022"],
    "types": ["@mariozechner/pi-coding-agent"]
  },
  "include": ["*.ts"]
}
```

## 🎨 Personalización

### Modificar la Herramienta

Edita `hello-world-extension.ts`:

```typescript
// Cambiar mensajes
const greetings = {
  en: `👋 Hello ${params.name}!`,
  es: `👋 ¡Hola ${params.name}!`,
  // Agrega más idiomas
};
```

### Agregar Nuevos Comandos

```typescript
pi.registerCommand("chau", {
  description: "Despedirse",
  handler: async (args) => {
    return { type: "success", message: `Goodbye ${args[0] || "World"}!` };
  }
});
```

### Cambiar Widget

```typescript
pi.registerWidget({
  id: "mi-widget",
  position: "header",  // o "footer"
  render: () => `📊 Mi Widget Personalizado`
});
```

## 🌐 Eventos Disponibles

| Evento | Descripción | Datos |
|--------|-------------|-------|
| `message` | Nuevo mensaje | `{ message, context }` |
| `tool_call` | Llamada a herramienta | `{ toolCall, context }` |
| `tool_result` | Resultado de herramienta | `{ toolResult, context }` |
| `agent_start` | Agente inicia | `{ context }` |
| `agent_end` | Agente termina | `{ context }` |

## 📚 API Reference

### `pi.registerTool(tool: Tool)`

Registra una herramienta personalizada.

### `pi.registerCommand(name: string, config: CommandConfig)`

Registra un comando CLI.

### `pi.on(event: string, handler: EventHandler)`

Registra un manejador de eventos.

### `pi.registerWidget(config: WidgetConfig)`

Registra un widget UI personalizado.

### `pi.logger`

Logger para la extensión:
- `pi.logger.info(message)`
- `pi.logger.error(message)`
- `pi.logger.debug(message)`

## 🧪 Testing

```bash
# Compilar TypeScript
npm run build

# Test manual
pi --extension ./dist/hello-world-extension.js "test"
```

## 🔍 Debugging

```bash
# Modo verbose
PI_TUI_WRITE_LOG=/tmp/pi.log pi --extension ./hello-world-extension.ts

# Ver logs
tail -f /tmp/pi.log
```

## 🚨 Consideraciones

- **Performance**: Mantener los handlers ligeros
- **Errores**: Usar try-catch en handlers asíncronos
- **Memoria**: Evitar leaks en event listeners
- **Compatibilidad**: Probar con diferentes versiones de pi

## 📦 Publicación

Para compartir tu extensión:

1. Publica en npm como `pi-extension-<nombre>`
2. Documenta instalación y uso
3. Incluye ejemplos
4. Especifica compatibilidad

## 🔗 Relacionado

- [Pi Extensions Documentation](docs/extensions.md)
- [Custom Provider Example](./custom-provider/README.md)
- [Custom Skill Example](./custom-skill/SKILL.md)

## 💡 Ideas para Extender

- Herramienta de traducción
- Comando para buscar documentación
- Widget de estado del sistema
- Integración con servicios externos (GitHub, Slack)
- Generador de reportes
- Sistema de notas

## 🙏 Créditos

Ejemplo creado para demostrar las capacidades de extensibilidad de pi.

---

**Versión**: 1.0.0  
**Última actualización**: 2026-01-15
