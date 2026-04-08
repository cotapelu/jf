# Fix Summary: interactive-mode.ts

## Problem
The file `packages/coding-agent/src/modes/interactive/interactive-mode.ts` had corrupted code at the end where:
1. The `showLoginDialog` method was incorrectly replaced with `showSimpleApiKeyLogin` 
2. Duplicated "Restore editor" code
3. Orphaned code fragments at the end of the file (manual code input handling from original OAuth flow)
4. Invalid callback signatures that didn't match the OAuthLoginCallbacks interface

## Solution
1. Restored the proper `showLoginDialog` method for OAuth login flow
2. Fixed `showSimpleApiKeyLogin` method to remove duplicates and correct logic
3. Removed orphaned code at end of file
4. Fixed callback signatures to match OAuthLoginCallbacks interface:
   - onAuth: (info: OAuthAuthInfo) => void
   - onPrompt: (prompt: OAuthPrompt) => Promise<string>
   - onProgress: (message: string) => void
5. Removed invalid callbacks: onWaiting, onCallbackUrl (not part of interface)

## Files Modified
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`

## Verification
- Build successful: `npm run build -- --scope @mariozechner/pi-coding-agent`
- All TypeScript errors resolved
- OAuth login flow restored
- Simple API key login preserved