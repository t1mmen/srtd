import figures from 'figures';
import { Box, Text } from 'ink';
import React from 'react';
import type { ProcessedTemplateResult } from '../types.js';
import { StatBadge } from './StatBadge.js';
import { COLOR_ERROR, COLOR_SKIP, COLOR_SUCCESS } from './customTheme.js';

interface Props {
  result: ProcessedTemplateResult;
  showBuild?: boolean;
  showApply?: boolean;
}

function ResultSection({
  items,
  label,
  variant,
}: { items: string[]; label: string; variant: 'build' | 'apply' | 'skip' }) {
  if (items.length === 0) return null;

  const icon =
    variant === 'build' ? figures.tick : variant === 'apply' ? figures.play : figures.pointerSmall;

  const maxItems = 30;
  const itemsToShow = items.slice(0, maxItems);
  const overflow = items.length > maxItems ? `... and ${items.length - maxItems} more` : '';
  const color = variant === 'skip' ? COLOR_SKIP : COLOR_SUCCESS;
  return (
    <Box flexDirection="column">
      <Text bold>{label}:</Text>
      <Box marginLeft={2} flexDirection="column">
        {itemsToShow.map(item => (
          <Text key={item} color={color}>
            {icon} {item}
          </Text>
        ))}
        {overflow && <Text dimColor>{overflow}</Text>}
      </Box>
    </Box>
  );
}

export function ProcessingResults({ result, showBuild = true, showApply = false }: Props) {
  return (
    <Box flexDirection="column" gap={1}>
      <ResultSection items={result.skipped} label="Skipped" variant="skip" />

      {showBuild && <ResultSection items={result.built} label="Built" variant="build" />}

      {showApply && <ResultSection items={result.applied} label="Applied" variant="apply" />}

      {result.errors.length > 0 && (
        <Box flexDirection="column">
          <Text color={COLOR_ERROR}>Errors:</Text>
          {result.errors.map(error => (
            <Text key={error.file} color={COLOR_ERROR}>
              {figures.cross} {error.templateName}: {error.error}
            </Text>
          ))}
        </Box>
      )}

      <Box marginBottom={1} gap={1}>
        {result.skipped.length > 0 && (
          <StatBadge label="Skipped" value={result.skipped.length} color={COLOR_SKIP} />
        )}
        {result.errors.length > 0 && (
          <StatBadge label="Errors" value={result.errors.length} color={COLOR_ERROR} />
        )}
        {result.built.length > 0 && (
          <StatBadge label="Built" value={result.built.length} color={COLOR_SUCCESS} />
        )}
        {result.applied.length > 0 && (
          <StatBadge label="Applied" value={result.applied.length} color={COLOR_SUCCESS} />
        )}
      </Box>
    </Box>
  );
}
