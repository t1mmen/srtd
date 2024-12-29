import {
  TemplateStatus,
  TemplateStateInfo,
  BuildStatus,
  ApplyStatus,
  TemplateState,
} from '../types.js';
import { isWipTemplate } from './isWipTemplate.js';

export async function shouldApplyTemplate(template: TemplateStatus): Promise<boolean> {
  const { currentHash, buildState } = template;

  // Only hash comparison matters for apply
  return buildState.lastAppliedHash !== currentHash;
}

export async function calculateTemplateState(template: TemplateStatus): Promise<TemplateStateInfo> {
  const { currentHash, buildState, path } = template;
  const isWip = await isWipTemplate(path);

  // Determine apply status - same logic for WIP and non-WIP
  const applyStatus = buildState.lastAppliedError
    ? ApplyStatus.ERROR
    : !buildState.lastAppliedHash
      ? ApplyStatus.NOT_APPLIED
      : buildState.lastAppliedHash === currentHash
        ? ApplyStatus.APPLIED
        : ApplyStatus.PENDING;

  // Build status - WIP templates are never built
  const buildStatus = isWip
    ? BuildStatus.NOT_BUILT
    : buildState.lastBuildError
      ? BuildStatus.ERROR
      : !buildState.lastBuildHash
        ? BuildStatus.NOT_BUILT
        : buildState.lastBuildHash === currentHash
          ? BuildStatus.BUILT
          : BuildStatus.MODIFIED;

  // Messages
  const buildMessage =
    buildState.lastBuildError ??
    (!isWip && buildStatus === BuildStatus.MODIFIED
      ? 'Template changed since last build'
      : undefined);

  const applyMessage =
    buildState.lastAppliedError ??
    (applyStatus === ApplyStatus.PENDING ? 'Changes not applied to database' : undefined);

  // Overall state
  const state = isWip
    ? TemplateState.WIP
    : applyStatus === ApplyStatus.APPLIED
      ? TemplateState.REGISTERED
      : buildStatus === BuildStatus.MODIFIED || applyStatus === ApplyStatus.PENDING
        ? TemplateState.MODIFIED
        : TemplateState.UNREGISTERED;

  return {
    state,
    buildStatus,
    applyStatus,
    currentHash,
    buildMessage,
    applyMessage,
  };
}

const statusColors = {
  [BuildStatus.BUILT]: 'green',
  [BuildStatus.MODIFIED]: 'yellow',
  [BuildStatus.ERROR]: 'red',
  [BuildStatus.NOT_BUILT]: 'gray',
  [ApplyStatus.APPLIED]: 'green',
  [ApplyStatus.PENDING]: 'yellow',
  [ApplyStatus.ERROR]: 'red',
  [ApplyStatus.NOT_APPLIED]: 'gray',
} as const;

const statusIcons = {
  [BuildStatus.BUILT]: '✓ Built',
  [BuildStatus.MODIFIED]: '⚠️ Modified',
  [BuildStatus.ERROR]: '❌ Failed',
  [BuildStatus.NOT_BUILT]: '- Not Built',
  [ApplyStatus.APPLIED]: '✓ Applied',
  [ApplyStatus.PENDING]: '⚠️ Pending',
  [ApplyStatus.ERROR]: '❌ Failed',
  [ApplyStatus.NOT_APPLIED]: '- Not Applied',
} as const;

export const getBuildStatusColor = (status: BuildStatus) => statusColors[status];
export const getApplyStatusColor = (status: ApplyStatus) => statusColors[status];
export const getBuildStatusIcon = (status: BuildStatus) => statusIcons[status];
export const getApplyStatusIcon = (status: ApplyStatus) => statusIcons[status];
