import { SettingsManager } from '@earendil-works/pi-coding-agent';

/**
 * ============================================
 * SETTINGS MANAGER - FULL API REFERENCE
 * ============================================
 *
 * File này chứa TOÀN BỘ methods có thể dùng của SettingsManager.
 *
 * HIỆN TẠI (main.ts):
 * - CHỈ DÙNG: SettingsManager.create(cwd, agentDir)
 * - KHÔNG dùng setter/getter nào khác
 *
 * CÁCH DÙNG:
 * 1. Xem danh sách bên dưới
 * 2. Uncomment (bỏ //) cái muốn dùng
 * 3. Thêm giá trị phù hợp
 * 4. Gọi configureSettings(settingsManager) trong main.ts SAU khi tạo settingsManager
 *
 * LƯU Ý:
 * - Tất cả setter đều persist async (fire-and-forget)
 * - Dùng await settingsManager.flush() nếu cần đợi write
 * - Chỉ uncomment cái thực sự cần, tránh unused config
 */

export function configureSettings(_settingsManager: SettingsManager): void {
  // ============================================
  // ⚡ HIỆN TẠI: CHỈ DÙNG ĐIỂN NÀY (main.ts)
  // ============================================
  // KHÔNG CÓ SETTER NÀO ĐƯỢC DÙNG TRONG MAIN.TS HIỆN TẠI
  // Chỉ dùng SettingsManager.create() với defaults
  //
  // Nếu muốn override defaults, uncomment các dòng bên dưới:


  // ============================================
  // 🎯 MODEL & PROVIDER SETTINGS
  // ============================================

  // // Set default provider (anthropic, openai, google, etc.)
  // settingsManager.setDefaultProvider('anthropic');

  // // Set default model ID
  // settingsManager.setDefaultModel('claude-opus-4-5');

  // // Set cả provider và model
  // settingsManager.setDefaultModelAndProvider('anthropic', 'claude-opus-4-5');

  // // Set default thinking level
  // settingsManager.setDefaultThinkingLevel('medium');


  // ============================================
  // 🌐 TRANSPORT & NETWORK
  // ============================================

  // // Transport: 'auto' | 'sse' | 'websocket'
  // settingsManager.setTransport('auto');

  // // HTTP idle timeout (ms) - default: 60000
  // settingsManager.setHttpIdleTimeoutMs(30000);

  // // WebSocket connect timeout (ms)
  // settingsManager.setWebSocketConnectTimeoutMs(10000);


  // ============================================
  // 📨 STEERING & QUEUE BEHAVIOR
  // ============================================

  // // Steering mode: 'all' (gửi tất cả cùng lúc) | 'one-at-a-time' (từng cái)
  // settingsManager.setSteeringMode('one-at-a-time');

  // // Follow-up mode: 'all' | 'one-at-a-time'
  // settingsManager.setFollowUpMode('one-at-a-time');


  // ============================================
  // 🎨 THEME & UI
  // ============================================

  // // Set theme name
  // settingsManager.setTheme('dark');


  // ============================================
  // 🗜️ COMPACTION & CONTEXT
  // ============================================

  // // Enable/disable auto compaction
  // settingsManager.setCompactionEnabled(true);

  // // COMPLEX: Set nested compaction config
  // // (Use applyOverrides for nested objects)
  // settingsManager.applyOverrides({
  //   compaction: {
  //     reserveTokens: 16384,
  //     keepRecentTokens: 20000
  //   }
  // });


  // ============================================
  // 🔄 RETRY & RESILIENCE
  // ============================================

  // // Enable/disable retry logic
  // settingsManager.setRetryEnabled(true);

  // // COMPLEX: Retry provider settings
  // settingsManager.applyOverrides({
  //   retry: {
  //     provider: {
  //       timeoutMs: 10000,
  //       maxRetries: 3,
  //       maxRetryDelayMs: 60000
  //     }
  //   }
  // });


  // ============================================
  // 💻 TERMINAL DISPLAY
  // ============================================

  // // Show images inline
  // settingsManager.setShowImages(true);

  // // Image width (terminal cells)
  // settingsManager.setImageWidthCells(60);

  // // Clear empty rows on shrink
  // settingsManager.setClearOnShrink(false);

  // // Show terminal progress (OSC 9;4)
  // settingsManager.setShowTerminalProgress(false);

  // // Hardware cursor for IME
  // settingsManager.setShowHardwareCursor(false);

  // // Editor horizontal padding (0-3)
  // settingsManager.setEditorPaddingX(0);

  // // Max autocomplete visible items
  // settingsManager.setAutocompleteMaxVisible(5);


  // ============================================
  // 🖼️ IMAGE HANDLING
  // ============================================

  // // Auto-resize images (max 2000x2000)
  // settingsManager.setImageAutoResize(true);

  // // Block all images from LLM
  // settingsManager.setBlockImages(false);


  // ============================================
  // 💻 SHELL & COMMANDS
  // ============================================

  // // Custom shell path (e.g., Cygwin)
  // settingsManager.setShellPath('/bin/bash');

  // // Command prefix for every bash command
  // settingsManager.setShellCommandPrefix('shopt -s expand_aliases');


  // ============================================
  // 💾 SESSION & FILES
  // ============================================

  // // Custom session directory
  // settingsManager.setSessionDir('/custom/sessions');


  // ============================================
  // 📦 PACKAGE MANAGEMENT
  // ============================================

  // // NPM command array (argv-style)
  // settingsManager.setNpmCommand(['npm']);
  // // Example: ['mise', 'exec', 'node@20', '--', 'npm']


  // ============================================
  // 📊 TELEMETRY & ANALYTICS
  // ============================================

  // // Install/update telemetry (default: true)
  // settingsManager.setEnableInstallTelemetry(true);

  // // Analytics opt-in (default: false)
  // settingsManager.setEnableAnalytics(false);
  // // Tracking ID auto-generated when enabled


  // ============================================
  // 📍 RESOURCE PATHS
  // ============================================

  // // Package sources (npm/git)
  // settingsManager.setPackages([
  //   'npm:@foo/bar@1.0.0',
  //   'git:github.com/user/repo@v1'
  // ]);

  // // Global extension paths
  // settingsManager.setExtensionPaths(['/path/to/extensions']);

  // // Project extension paths
  // settingsManager.setProjectExtensionPaths(['./.pi/custom-extensions']);

  // // Global skill paths
  // settingsManager.setSkillPaths(['/path/to/skills']);

  // // Project skill paths
  // settingsManager.setProjectSkillPaths(['./.pi/custom-skills']);

  // // Global prompt template paths
  // settingsManager.setPromptTemplatePaths(['/path/to/prompts']);

  // // Project prompt template paths
  // settingsManager.setProjectPromptTemplatePaths(['./.pi/custom-prompts']);

  // // Global theme paths
  // settingsManager.setThemePaths(['/path/to/themes']);

  // // Project theme paths
  // settingsManager.setProjectThemePaths(['./.pi/custom-themes']);


  // ============================================
  // ⚙️ FEATURE FLAGS
  // ============================================

  // // Enable skill commands (/skill:name)
  // settingsManager.setEnableSkillCommands(true);

  // // Hide thinking blocks
  // settingsManager.setHideThinkingBlock(false);

  // // Quiet startup (less logs)
  // settingsManager.setQuietStartup(false);


  // ============================================
  // 🌲 SESSION TREE NAVIGATION
  // ============================================

  // // Double-escape action
  // settingsManager.setDoubleEscapeAction('tree'); // 'fork' | 'tree' | 'none'

  // // Default tree filter mode
  // settingsManager.setTreeFilterMode('default'); // 'default' | 'no-tools' | 'user-only' | 'labeled-only' | 'all'


  // ============================================
  // 📝 MARKDOWN RENDERING
  // ============================================

  // // Code block indentation
  // settingsManager.setCodeBlockIndent('  ');


  // ============================================
  // ⚠️ WARNINGS & SUPPRESSIONS
  // ============================================

  // // Suppress specific warnings
  // settingsManager.setWarnings({
  //   anthropicExtraUsage: false
  // });


  // ============================================
  // 🔐 PROJECT TRUST
  // ============================================

  // // Default project trust for non-interactive: 'ask' | 'always' | 'never'
  // settingsManager.setDefaultProjectTrust('ask');


  // ============================================
  // 🔢 MODEL CYCLING (Ctrl+P)
  // ============================================

  // // Enabled models patterns for cycling
  // settingsManager.setEnabledModels(['claude-*', 'gpt-4o']);


  // ============================================
  // 🔄 DYNAMIC SETTINGS (Runtime only)
  // ============================================
  // These don't persist to file:
  //
  // settingsManager.applyOverrides({ ... }); // Temporary overrides
  // await settingsManager.reload();          // Reload from file
  // await settingsManager.flush();           // Wait for async writes
  // const errors = settingsManager.drainErrors(); // Collect errors


  // ============================================
  // 📖 GETTERS (Read-only)
  // ============================================
  // Getters không cần comment vì chỉ đọc, không set.
  // Xem danh sách đầy đủ trong SettingsManager class.
  //
  // Ví dụ getters:
  // - getDefaultProvider()
  // - getDefaultModel()
  // - getTransport()
  // - getSteeringMode()
  // - getTheme()
  // - getCompactionEnabled()
  // - ... (hơn 40 getters)
}

// ============================================
// USAGE IN main.ts
// ============================================
/*
import { SettingsManager } from '@earendil-works/pi-coding-agent';
import { configureSettings } from './settings-config.js';

// Create settings manager
const settingsManager = SettingsManager.create(cwd, agentDir);

// Apply custom config (uncomment trong configureSettings trước)
configureSettings(settingsManager);

// Pass to services
const services = await createAgentSessionServices({
  cwd,
  agentDir,
  settingsManager,  // ← custom settings
  resourceLoaderOptions: { ... },
});
*/

// ============================================
// CURRENTLY USED IN JF main.ts
// ============================================
/*
HIỆN TẠI: CHỈ DÙNG
- SettingsManager.create(cwd, agentDir)

KHÔNG DÙNG:
- Tất cả setter methods
- applyOverrides()
- reload()
- flush()
- drainErrors()
*/
