import { Box, Text } from 'ink';
import React from 'react';
import type { ProcessedTemplateResult } from '../types.js';
import { COLOR_ERROR } from './customTheme.js';

interface Props {
  result: ProcessedTemplateResult;
  showBuild?: boolean;
  showApply?: boolean;
}

function ResultSection({ items, label }: { items: string[]; label: string }) {
  if (items.length === 0) return null;

  return (
    <Box flexDirection="column">
      <Text>{label}:</Text>
      {items.map(item => (
        <Text key={item}> ✓ {item}</Text>
      ))}
    </Box>
  );
}

export function ProcessingResults({ result, showBuild = true, showApply = false }: Props) {
  return (
    <Box flexDirection="column" gap={1}>
      {showBuild && <ResultSection items={result.built} label="Built" />}

      {showApply && <ResultSection items={result.applied} label="Applied" />}

      {result.skipped.length > 0 && (
        <Text dimColor>Skipped {result.skipped.length} template(s)</Text>
      )}

      {result.errors.length > 0 && (
        <Box flexDirection="column">
          <Text color={COLOR_ERROR}>Errors:</Text>
          {result.errors.map(error => (
            <Text key={error.file} color={COLOR_ERROR}>
              ✗ {error.templateName}: {error.error}
            </Text>
          ))}
        </Box>
      )}

      {!result.built.length && !result.applied.length && !result.errors.length && (
        <Text>No changes made</Text>
      )}
    </Box>
  );
}
