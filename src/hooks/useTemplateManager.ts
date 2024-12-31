// src/hooks/useTemplateManager.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TemplateManager } from '../lib/templateManager.js';
import type { TemplateStatus } from '../types.js';
import { getConfig } from '../utils/config.js';

export type TemplateUpdate = {
  type: 'applied' | 'changed' | 'error';
  template: TemplateStatus;
  timestamp: string;
  error?: string;
  path: string;
};

export interface TemplateStats {
  total: number;
  needsBuild: number;
  recentlyChanged: number;
  errors: number;
}

export interface UseTemplateManager {
  templates: TemplateStatus[];
  updates: TemplateUpdate[];
  stats: TemplateStats;
  isLoading: boolean;
  errors: Map<string, string>;
  latestPath?: string;
  templateDir?: string;
}

export function useTemplateManager(cwd: string = process.cwd()): UseTemplateManager {
  const [templates, setTemplates] = useState<TemplateStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [updates, setUpdates] = useState<TemplateUpdate[]>([]);
  const [templateDir, setTemplateDir] = useState<string>();
  const managerRef = useRef<TemplateManager>();
  const latestPath = useRef<string>();
  const mounted = useRef(true);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      const dateA = a.buildState.lastAppliedDate || '';
      const dateB = b.buildState.lastAppliedDate || '';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      const folderA = a.path.split('/').slice(0, -1).join('/');
      const folderB = b.path.split('/').slice(0, -1).join('/');
      return folderA.localeCompare(folderB);
    });
  }, [templates]);

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

  const updateTemplate = useCallback(
    async (template: TemplateStatus, type: TemplateUpdate['type'], errorMsg?: string) => {
      if (!mounted.current || !managerRef.current) return;

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          const status = await managerRef.current?.getTemplateStatus(template.path);
          if (status) {
            latestPath.current = status.path;
            setTemplates(prev => {
              const rest = prev.filter(t => t.path !== status.path);
              return [...rest, status];
            });

            if (type === 'error' && errorMsg) {
              setErrors(prev => new Map(prev).set(template.path, errorMsg));
            } else if (type === 'applied') {
              setErrors(prev => {
                const next = new Map(prev);
                next.delete(template.path);
                return next;
              });
            }

            const update: TemplateUpdate = {
              type,
              template: status,
              timestamp: new Date().toISOString(),
              error: errorMsg,
              path: template.path,
            };

            setUpdates(prev =>
              [update, ...prev]
                .filter(
                  (u, i, arr) => i === arr.findIndex(t => t.path === u.path && t.type === u.type)
                )
                .slice(0, 50)
            );
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error('Failed to update template:', errorMessage);
        }
      }, 500); // Todo: performance should be looked at here, likely
    },
    []
  );

  useEffect(() => {
    let watcher: { close: () => void } | undefined;

    async function init(): Promise<void> {
      try {
        setIsLoading(true);
        const config = await getConfig(cwd);
        setTemplateDir(config.templateDir);

        managerRef.current = await TemplateManager.create(cwd, { silent: true });

        async function loadTemplates() {
          const initialTemplates = await managerRef.current?.findTemplates();
          const statuses = await Promise.all(
            initialTemplates?.map(t => managerRef.current?.getTemplateStatus(t)) ?? []
          );

          const validStatuses = statuses.filter((s): s is TemplateStatus => s !== null);
          const needsApply = validStatuses.some(
            t => !t.buildState.lastAppliedHash || t.currentHash !== t.buildState.lastAppliedHash
          );

          if (mounted.current) {
            setTemplates(validStatuses);
            setIsLoading(false);

            if (needsApply) {
              await managerRef.current?.processTemplates({ apply: true });
            }
          }
        }

        await loadTemplates();
        watcher = await managerRef.current?.watch();

        managerRef.current?.on('templateAdded', () => void loadTemplates());
        managerRef.current?.on('templateChanged', t => void updateTemplate(t, 'changed'));
        managerRef.current?.on('templateApplied', t => void updateTemplate(t, 'applied'));
        managerRef.current?.on('templateError', ({ template, error: err }) => {
          const errorMsg =
            err instanceof Error
              ? err.message
              : typeof err === 'object' && err !== null
                ? JSON.stringify(err)
                : String(err);
          void updateTemplate(template, 'error', errorMsg);
        });
      } catch (err) {
        if (mounted.current) {
          setErrors(new Map().set('global', err instanceof Error ? err.message : String(err)));
          setIsLoading(false);
        }
      }
    }

    void init();
    return () => {
      mounted.current = false;
      watcher?.close();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [cwd, updateTemplate]);

  return {
    templates: sortedTemplates,
    updates,
    stats,
    isLoading,
    errors,
    latestPath: latestPath.current,
    templateDir,
  };
}
