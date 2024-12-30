// hooks/useTemplateState.ts
import { useEffect, useState } from 'react';
import { TemplateManager } from '../lib/templateManager.js';
import type { TemplateStatus } from '../types.js';

export function useTemplateState() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TemplateStatus[]>([]);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const baseDir = process.cwd();
        const manager = await TemplateManager.create(baseDir);
        const templates = await manager.findTemplates();
        const statuses = await Promise.all(templates.map(t => manager.getTemplateStatus(t)));
        setItems(statuses);
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
