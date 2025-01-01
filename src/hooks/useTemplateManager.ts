// src/hooks/useTemplateManager.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { TemplateManager } from '../lib/templateManager.js';
import type { TemplateStatus } from '../types.js';
import { getConfig } from '../utils/config.js';

export type TemplateUpdate = {
  type: 'applied' | 'changed' | 'error';
  template: TemplateStatus;
  timestamp: string;
  error?: string;
};

export interface UseTemplateManager {
  templates: TemplateStatus[];
  updates: TemplateUpdate[];
  stats: {
    total: number;
    needsBuild: number;
    recentlyChanged: number;
    errors: number;
  };
  isLoading: boolean;
  errors: Map<string, string>;
  latestPath?: string;
  templateDir?: string;
}

export function useTemplateManager(cwd: string = process.cwd()): UseTemplateManager {
  const [templates, setTemplates] = useState<TemplateStatus[]>([]);
  const [updates, setUpdates] = useState<TemplateUpdate[]>([]);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [templateDir, setTemplateDir] = useState<string>();
  const [latestPath, setLatestPath] = useState<string>();
  const managerRef = useRef<TemplateManager>();

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((a, b) => {
        const dateA = a.buildState.lastAppliedDate || '';
        const dateB = b.buildState.lastAppliedDate || '';
        return dateA.localeCompare(dateB);
      }),
    [templates]
  );

  const stats = useMemo(
    () => ({
      total: templates.length,
      needsBuild: templates.filter(
        t => !t.buildState.lastBuildDate || t.currentHash !== t.buildState.lastBuildHash
      ).length,
      recentlyChanged: updates.filter(u => {
        const timestamp = new Date(u.timestamp);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return timestamp > fiveMinutesAgo;
      }).length,
      errors: errors.size,
    }),
    [templates, updates, errors]
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const config = await getConfig(cwd);
        setTemplateDir(config.templateDir);

        managerRef.current = await TemplateManager.create(cwd, { silent: true });

        // Setup event handlers
        managerRef.current.on('templateChanged', template => {
          if (!mounted) return;
          setLatestPath(template.path);
          setUpdates(prev =>
            [
              {
                type: 'changed' as const,
                template,
                timestamp: new Date().toISOString(),
              },
              ...prev,
            ].slice(0, 50)
          );
        });

        managerRef.current.on('templateApplied', template => {
          if (!mounted) return;
          setLatestPath(template.path);
          setTemplates(prev => {
            const rest = prev.filter(t => t.path !== template.path);
            return [...rest, template];
          });
          setUpdates(prev =>
            [
              {
                type: 'applied' as const,
                template,
                timestamp: new Date().toISOString(),
              },
              ...prev,
            ].slice(0, 50)
          );
          setErrors(prev => {
            const next = new Map(prev);
            next.delete(template.path);
            return next;
          });
        });

        managerRef.current.on('templateError', ({ template, error: err }) => {
          if (!mounted) return;
          // Ensure error is properly stringified
          const errorMsg =
            typeof err === 'object'
              ? err instanceof Error
                ? err.message
                : JSON.stringify(err)
              : String(err);

          setErrors(prev => new Map(prev).set(template.path, errorMsg));
          setUpdates(prev =>
            [
              {
                type: 'error' as const,
                template,
                timestamp: new Date().toISOString(),
                error: errorMsg,
              },
              ...prev,
            ].slice(0, 50)
          );
        });

        // Initial load
        const initialTemplates = await managerRef.current.findTemplates();
        const statuses = await Promise.all(
          initialTemplates.map(t => managerRef.current?.getTemplateStatus(t))
        );

        if (mounted) {
          setTemplates(statuses.filter((s): s is TemplateStatus => s !== null));
          setIsLoading(false);
        }

        // Start watching
        await managerRef.current.watch();
      } catch (err) {
        if (mounted) {
          setErrors(new Map().set('global', String(err)));
          setIsLoading(false);
        }
      }
    }

    void init();

    return () => {
      mounted = false;
      managerRef.current?.[Symbol.dispose]();
    };
  }, [cwd]);

  return {
    templates: sortedTemplates,
    updates,
    stats,
    isLoading,
    errors,
    latestPath,
    templateDir,
  };
}
