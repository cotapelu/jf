# Custom Provider Example - Ollama

Este ejemplo muestra cómo agregar un provider LLM personalizado (Ollama) al ecosistema Pi.

## 📄 Archivos del Ejemplo

- `src/providers/ollama.ts` - Implementación del provider
- `src/models/ollama.ts` - Definición de modelos Ollama
- `package.json` - Export paths y dependencias

## 🔧 Implementación

### 1. Definición del Provider

```typescript
import { BaseProvider } from "@mariozechner/pi-ai";

export class OllamaProvider extends BaseProvider {
  name = "ollama";
  api = "openai-completions"; // Usa API compatible
  
  async stream(model, context, options) {
    // Implementación de streaming para Ollama
    const response = await fetch(`${model.baseUrl}/api/chat`, {
      method: "POST",
      body: JSON.stringify({
        model: model.id,
        messages: context.messages,
        stream: true,
      }),
    });
    // ... procesamiento de streaming
  }
}
```

### 2. Registro del Provider

```typescript
import { registerApiProvider } from "@mariozechner/pi-ai";
import { OllamaProvider } from "./providers/ollama";

registerApiProvider("ollama", new OllamaProvider());
```

### 3. Definición de Modelos

```typescript
import { Model } from "@mariozechner/pi-ai";

export const ollamaModels: Model[] = [
  {
    id: "llama2",
    name: "Llama 2",
    api: "openai-completions",
    provider: "ollama",
    baseUrl: "http://localhost:11434/v1",
    contextWindow: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    input: ["text"],
    reasoning: false,
  },
];
```

## ⚙️ Configuración

### settings.json

```json
{
  "ollama": {
    "enabled": true,
    "baseUrl": "http://localhost:11434/v1",
    "models": ["llama2", "mistral"]
  }
}
```

### Uso en pi CLI

```bash
# Seleccionar modelo Ollama
pi --provider ollama --model llama2 "Hola mundo"

# Con URL personalizada
pi --provider ollama --model llama2 --api-key dummy \
   --base-url http://localhost:11434/v1 \
   "Escribe un poema"
```

## 🛠️ Características Soportadas

- ✅ Streaming de respuestas
- ✅ Tool calling (si el modelo lo soporta)
- ✅ Context window configurables
- ✅ Costo cero (local)
- ❌ Reasoning/thinking blocks (depende del modelo)
- ❌ Image input (depende del modelo)

## 📦 Instalación

```bash
# Clonar el ejemplo
cd examples/custom-provider
npm install

# Construir
npm run build

# Usar en pi
pi --extension ./dist/index.js
```

## 🔍 Verificación

```bash
# Listar modelos disponibles
pi --list-models ollama

# Probar conexión
pi --provider ollama --model llama2 "¿Estás ahí?"
```

## ⚠️ Consideraciones

1. **Seguridad**: Ollama corre localmente, asegurar acceso a la API
2. **Performance**: Depende del hardware local
3. **Compatibilidad**: Verificar capacidades del modelo específico
4. **Contexto**: Límites de ventana de contexto varían por modelo

## 📚 Recursos

- [Documentación Ollama](https://ollama.ai)
- [API de Ollama](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Modelos disponibles](https://ollama.ai/library)

## 🔗 Relacionado

- [Custom Skills](./custom-skill/README.md)
- [Custom Extension](./custom-extension/README.md)
