import { useEffect, useRef, useState } from 'react';
import { TemplateManager } from '../lib/templateManager.js';
import type { ProcessedTemplateResult } from '../types.js';
import { disconnect } from '../utils/databaseConnection.js';

interface ProcessorOptions {
  force?: boolean;
  apply?: boolean;
  generateFiles?: boolean;
}

export function useTemplateProcessor(options: ProcessorOptions) {
  const [result, setResult] = useState<ProcessedTemplateResult>({
    applied: [],
    errors: [],
    skipped: [],
    built: [],
  });
  const [isProcessing, setIsProcessing] = useState(true);
  const managerRef = useRef<TemplateManager>();
  const processedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function doProcess() {
      // Prevent duplicate processing
      if (processedRef.current) return;
      processedRef.current = true;

      try {
        if (!managerRef.current) {
          managerRef.current = await TemplateManager.create(process.cwd(), {
            silent: true,
          });
        }

        const result = await managerRef.current.processTemplates(options);

        if (mounted) {
          setResult(result);
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Processing error:', err);

        if (mounted) {
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
    }

    void doProcess();

    return () => {
      mounted = false;
      // Only dispose if we're unmounting
      if (managerRef.current) {
        void disconnect();
        managerRef.current[Symbol.dispose]?.();
        managerRef.current = undefined;
        processedRef.current = false;
      }
    };
  }, [options]);

  return { result, isProcessing };
}
