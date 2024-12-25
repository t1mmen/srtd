import { useState, useEffect } from 'react';
import { loadBuildLog } from '../utils/loadBuildLog';
import { loadTemplates } from '../utils/loadTemplates';
import { TemplateStatus } from '../types';
import path from 'path';

export function useTemplateState() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TemplateStatus[]>([]);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const dirname = process.cwd();
        const templates = await loadTemplates(dirname);
        const buildLog = await loadBuildLog(dirname, 'common');
        const localBuildLog = await loadBuildLog(dirname, 'local');

        const combined: TemplateStatus[] = templates.map(t => ({
          name: t.name,
          path: path.relative(dirname, t.path),
          currentHash: t.currentHash,
          migrationHash: t.migrationHash,
          buildState: {
            ...buildLog.templates[path.relative(dirname, t.path)],
            ...localBuildLog.templates[path.relative(dirname, t.path)],
          },
        }));

        setItems(combined);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  return { loading, error, items };
}
