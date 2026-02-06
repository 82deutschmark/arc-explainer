/*
Author: Cascade (Claude Sonnet 4)
Date: 2026-02-01
PURPOSE: Drag-and-drop Python file uploader for ARC3 community game submissions.
         Validates file size, shows syntax preview, and provides visual feedback.
         Supports up to 2000 lines of code per the submission requirements.
SRP/DRY check: Pass — single-purpose uploader component with validation.
*/

import { useState, useCallback } from 'react';
import { Upload, FileCode, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const MAX_LINES = 2000;

export interface FileValidation {
  isValid: boolean;
  fileName: string;
  fileSize: number;
  lineCount: number;
  errors: string[];
  warnings: string[];
}

interface PythonFileUploaderProps {
  onFileChange: (sourceCode: string | null, validation: FileValidation | null) => void;
  className?: string;
}

export function PythonFileUploader({ onFileChange, className }: PythonFileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [validation, setValidation] = useState<FileValidation | null>(null);
  const [sourceCode, setSourceCode] = useState<string | null>(null);

  const validateFile = useCallback((file: File, content: string): FileValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines = content.split('\n');

    if (!file.name.endsWith('.py')) {
      errors.push('File must be a Python file (.py)');
    }

    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size ${(file.size / 1024).toFixed(1)}KB exceeds limit of ${MAX_FILE_SIZE / 1024}KB`);
    }

    if (lines.length > MAX_LINES) {
      errors.push(`File has ${lines.length} lines, exceeding the limit of ${MAX_LINES} lines`);
    }

    // Basic structure checks
    const hasImport = content.includes('import') || content.includes('from');
    const hasClass = /class\s+\w+/i.test(content);
    const hasARCBaseGame = /ARCBaseGame/i.test(content);

    if (!hasImport) {
      warnings.push('No import statements detected');
    }

    if (!hasClass) {
      errors.push('No class definition found');
    }

    if (!hasARCBaseGame) {
      warnings.push('ARCBaseGame not found - game must subclass ARCBaseGame');
    }

    return {
      isValid: errors.length === 0,
      fileName: file.name,
      fileSize: file.size,
      lineCount: lines.length,
      errors,
      warnings,
    };
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const validationResult = validateFile(file, content);
      setValidation(validationResult);
      setSourceCode(content);
      onFileChange(content, validationResult);
    };
    reader.readAsText(file);
  }, [validateFile, onFileChange]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleClear = useCallback(() => {
    setValidation(null);
    setSourceCode(null);
    onFileChange(null, null);
  }, [onFileChange]);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Upload zone */}
      {!validation && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)]',
            'p-6 text-center cursor-pointer transition-colors',
            dragActive && 'border-[var(--arc3-c11)] bg-[var(--arc3-c4)]',
          )}
        >
          <input
            type="file"
            accept=".py"
            onChange={handleChange}
            className="hidden"
            id="python-file-upload"
          />
          <label htmlFor="python-file-upload" className="cursor-pointer">
            <Upload className="w-8 h-8 mx-auto mb-3 text-[var(--arc3-dim)]" />
            <p className="text-xs font-semibold mb-1">Drop your Python file here or click to browse</p>
            <p className="text-[11px] text-[var(--arc3-dim)]">
              .py files only • Max {MAX_FILE_SIZE / 1024}KB • Up to {MAX_LINES.toLocaleString()} lines
            </p>
          </label>
        </div>
      )}

      {/* Validation results */}
      {validation && (
        <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)]">
          {/* File info header */}
          <div className="border-b-2 border-[var(--arc3-border)] p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="w-4 h-4 text-[var(--arc3-c9)] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold font-mono truncate">{validation.fileName}</p>
                <p className="text-[11px] text-[var(--arc3-dim)]">
                  {(validation.fileSize / 1024).toFixed(1)}KB • {validation.lineCount.toLocaleString()} lines
                </p>
              </div>
            </div>
            <button
              onClick={handleClear}
              className="shrink-0 p-1 hover:bg-[var(--arc3-panel)] rounded"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Validation messages */}
          <div className="p-3 space-y-2">
            {/* Errors */}
            {validation.errors.length > 0 && (
              <div className="space-y-1">
                {validation.errors.map((error, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-[var(--arc3-c8)]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div className="space-y-1">
                {validation.warnings.map((warning, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-[var(--arc3-c11)]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Success */}
            {validation.isValid && validation.errors.length === 0 && (
              <div className="flex items-center gap-2 text-[11px] text-[var(--arc3-c14)]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>File ready for upload - server-side validation will run after submission</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
