/**
 * UUID module type declarations
 * 
 * Author: Gemini 2.5 Pro
 * Date: 2025-09-26T14:40:45-04:00
 * PURPOSE: Provides TypeScript declarations for the uuid module.
 * Fixes compilation errors when importing uuid/v4.
 * SRP and DRY check: Pass - Single responsibility for UUID type declarations only.
 */

declare module 'uuid' {
  export function v4(): string;
}
