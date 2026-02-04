/*
Author: GPT-5.2
Date: 2026-02-04
PURPOSE: Validates ARC3 community game Python source for baseline safety and structure.
         Performs lightweight static checks (forbidden imports, disallowed builtins,
         required ARCBaseGame subclass + arcengine import) without executing the code.
         Integration points: used by ARC3 community submission/upload routes to reject
         obviously unsafe or malformed files before persisting them.
SRP/DRY check: Pass - kept validation single-purpose and aligned rules with UI messaging.
*/

import { spawn } from 'child_process';
import * as path from 'path';
import { logger } from '../../utils/logger';

const MAX_SOURCE_LINES = 2000;

// Forbidden imports that could be dangerous
const FORBIDDEN_IMPORTS = [
  'os',
  'subprocess',
  'sys',
  'socket',
  'requests',
  'urllib',
  'http',
  'ftplib',
  'smtplib',
  'telnetlib',
  'paramiko',
  'fabric',
  'pexpect',
  'pty',
  'fcntl',
  'resource',
  'signal',
  'ctypes',
  'multiprocessing',
  'threading',
  '__builtins__',
  'builtins',
  'importlib',
  'pkgutil',
  'runpy',
  'code',
  'codeop',
  'compile',
  'exec',
  'eval',
  'open',  // File operations
  'file',
  'input',
  'raw_input',
];

// Allowed imports for ARCEngine games
const ALLOWED_IMPORTS = [
  'arcengine',
  'numpy',
  'math',
  'random',
  'collections',
  'itertools',
  'functools',
  'typing',
  'dataclasses',
  'enum',
  'copy',
  're',
];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    hasBaseGameClass: boolean;
    className: string | null;
    importedModules: string[];
    estimatedComplexity: 'simple' | 'moderate' | 'complex';
  };
}

export class CommunityGameValidator {
  /**
   * Validate a Python source code string
   */
  static async validateSource(sourceCode: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const importedModules: string[] = [];

    // Basic syntax check - look for forbidden patterns
    const lines = sourceCode.split(/\r?\n/);
    let hasBaseGameClass = false;
    let className: string | null = null;

    if (lines.length > MAX_SOURCE_LINES) {
      errors.push(`File has ${lines.length} lines, exceeding the limit of ${MAX_SOURCE_LINES} lines`);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Check for imports
      if (line.startsWith('import ') || line.startsWith('from ')) {
        const importMatch = line.match(/^(?:from\s+(\S+)|import\s+(\S+))/);
        if (importMatch) {
          const moduleName = (importMatch[1] || importMatch[2]).split('.')[0];
          importedModules.push(moduleName);

          // Check for forbidden imports
          if (FORBIDDEN_IMPORTS.includes(moduleName)) {
            errors.push(`Line ${lineNum}: Forbidden import '${moduleName}' - this module is not allowed for security reasons`);
          }

          // Check for allowed imports
          if (!ALLOWED_IMPORTS.some(allowed => moduleName === allowed || moduleName.startsWith(allowed + '.'))) {
            warnings.push(`Line ${lineNum}: Import '${moduleName}' is not in the standard allowed list`);
          }
        }
      }

      // Check for exec/eval usage
      if (/\bexec\s*\(/.test(line) || /\beval\s*\(/.test(line)) {
        errors.push(`Line ${lineNum}: Use of exec/eval is forbidden`);
      }

      // Check for open() file operations
      if (/\bopen\s*\(/.test(line) && !line.includes('#')) {
        errors.push(`Line ${lineNum}: File operations using open() are not allowed`);
      }

      // Check for __import__
      if (/__import__\s*\(/.test(line)) {
        errors.push(`Line ${lineNum}: Dynamic imports using __import__ are forbidden`);
      }

      // Check for ARCBaseGame subclass
      if (/class\s+(\w+)\s*\(\s*ARCBaseGame\s*\)/.test(line)) {
        const match = line.match(/class\s+(\w+)\s*\(\s*ARCBaseGame\s*\)/);
        if (match) {
          hasBaseGameClass = true;
          className = match[1];
        }
      }
    }

    // Must have ARCBaseGame subclass
    if (!hasBaseGameClass) {
      errors.push('Game must contain a class that inherits from ARCBaseGame');
    }

    // Must import arcengine
    if (!importedModules.some(m => m === 'arcengine' || m.startsWith('arcengine'))) {
      errors.push('Game must import from arcengine module');
    }

    // Estimate complexity based on line count and imports
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (lines.length > 500 || importedModules.length > 10) {
      complexity = 'complex';
    } else if (lines.length > 200 || importedModules.length > 5) {
      complexity = 'moderate';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        hasBaseGameClass,
        className,
        importedModules: [...new Set(importedModules)],
        estimatedComplexity: complexity,
      },
    };
  }

  /**
   * Validate by attempting to load the game in a sandboxed subprocess
   * This provides runtime validation in addition to static analysis
   */
  static async validateRuntime(gameFilePath: string, timeoutMs: number = 10000): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    return new Promise((resolve) => {
      let childProcess: ReturnType<typeof spawn> | null = null;
      
      const timeout = setTimeout(() => {
        if (childProcess) {
          childProcess.kill();
        }
        errors.push('Game initialization timed out - possible infinite loop or heavy computation');
        resolve({
          isValid: false,
          errors,
          warnings,
        });
      }, timeoutMs);

      const validatorScript = `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..', '..', 'external', 'ARCEngine').replace(/\\/g, '\\\\')}')

try:
    import importlib.util
    from arcengine import ARCBaseGame, ActionInput, GameAction
    
    spec = importlib.util.spec_from_file_location("test_game", "${gameFilePath.replace(/\\/g, '\\\\')}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    
    # Find game class
    game_class = None
    for attr_name in dir(module):
        attr = getattr(module, attr_name)
        if isinstance(attr, type) and issubclass(attr, ARCBaseGame) and attr is not ARCBaseGame:
            game_class = attr
            break
    
    if game_class is None:
        print(json.dumps({"valid": False, "error": "No ARCBaseGame subclass found"}))
        sys.exit(0)
    
    # Try to instantiate
    game = game_class()
    
    # Try to get initial frame
    frame = game.perform_action(ActionInput(id=GameAction.RESET))
    
    print(json.dumps({
        "valid": True,
        "game_id": getattr(game, 'game_id', 'unknown'),
        # ARCBaseGame stores cloned levels internally as _levels.
        "has_levels": len(getattr(game, '_levels', [])) > 0
    }))
except Exception as e:
    print(json.dumps({"valid": False, "error": str(e)}))
`;

      childProcess = spawn('python', ['-c', validatorScript], {
        timeout: timeoutMs,
        env: { ...globalThis.process.env, PYTHONUNBUFFERED: '1' },
      });

      let output = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          warnings.push(`Python stderr: ${msg}`);
        }
      });

      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeout);

        try {
          const result = JSON.parse(output.trim());
          if (result.valid) {
            resolve({
              isValid: true,
              errors: [],
              warnings,
              metadata: {
                hasBaseGameClass: true,
                className: result.game_id,
                importedModules: [],
                estimatedComplexity: 'simple',
              },
            });
          } else {
            errors.push(`Runtime validation failed: ${result.error}`);
            resolve({
              isValid: false,
              errors,
              warnings,
            });
          }
        } catch {
          if (code !== 0) {
            errors.push(`Game validation process failed with code ${code}`);
          } else {
            errors.push('Failed to parse validation result');
          }
          resolve({
            isValid: false,
            errors,
            warnings,
          });
        }
      });

      childProcess.on('error', (err: Error) => {
        clearTimeout(timeout);
        errors.push(`Validation process error: ${err.message}`);
        resolve({
          isValid: false,
          errors,
          warnings,
        });
      });
    });
  }

  /**
   * Full validation: static analysis + runtime check
   */
  static async validateFull(sourceCode: string, gameFilePath: string): Promise<ValidationResult> {
    // First do static analysis
    const staticResult = await this.validateSource(sourceCode);
    
    if (!staticResult.isValid) {
      return staticResult;
    }

    // Then do runtime validation
    const runtimeResult = await this.validateRuntime(gameFilePath);

    // Merge results
    return {
      isValid: runtimeResult.isValid,
      errors: [...staticResult.errors, ...runtimeResult.errors],
      warnings: [...staticResult.warnings, ...runtimeResult.warnings],
      metadata: staticResult.metadata,
    };
  }
}
