import { useEffect, useRef, useState } from 'react';
import { TemplateManager } from '../lib/templateManager.js';
import type { ProcessedTemplateResult } from '../types.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';

interface ProcessorOptions {
  force?: boolean;
  apply?: boolean;
  generateFiles?: boolean;
  onComplete?: () => void;
}

export function useTemplateProcessor(options: ProcessorOptions) {
  const [result, setResult] = useState<ProcessedTemplateResult>({
    applied: [],
    errors: [],
    skipped: [],
    built: [],
  });
  const [isProcessing, setIsProcessing] = useState(true);
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    async function doProcessing() {
      try {
        const projectRoot = await findProjectRoot();
        using manager = await TemplateManager.create(projectRoot, { silent: true });
        const result = await manager.processTemplates(options);
        setResult(result);
        setIsProcessing(false);
        options.onComplete?.();
      } catch (err) {
        console.error('Processing error:', err);
        setResult(prev => ({
          ...prev,
          errors: [
            ...prev.errors,
            {
              file: 'process',
              templateName: 'global',
              error: err instanceof Error ? err.message : String(err),
            },
          ],
        }));
        setIsProcessing(false);
      }
    }

    void doProcessing();
  }, [options]);

  return { result, isProcessing };
}
