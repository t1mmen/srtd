import {
  TemplateStatus,
  TemplateStateInfo,
  BuildStatus,
  ApplyStatus,
  TemplateState,
} from '../rtsql/rtsql.types';
import { isWipTemplate } from './isWipTemplate';

export function calculateTemplateState(template: TemplateStatus): TemplateStateInfo {
  const { currentHash, buildState, path } = template;
  const isWip = isWipTemplate(path);

  // Build status tracks migration generation
  let buildStatus = BuildStatus.NOT_BUILT;
  let buildMessage;

  if (buildState.lastBuildError) {
    buildStatus = BuildStatus.ERROR;
    buildMessage = buildState.lastBuildError;
  } else if (!buildState.lastBuildHash) {
    buildStatus = BuildStatus.NOT_BUILT;
  } else if (buildState.lastBuildHash === currentHash) {
    buildStatus = BuildStatus.BUILT;
  } else {
    buildStatus = BuildStatus.MODIFIED;
    buildMessage = 'Template changed since last build';
  }

  // Apply status tracks database state
  let applyStatus = ApplyStatus.NOT_APPLIED;
  let applyMessage;

  if (buildState.lastAppliedError) {
    applyStatus = ApplyStatus.ERROR;
    applyMessage = buildState.lastAppliedError;
  } else if (!buildState.lastAppliedHash) {
    applyStatus = ApplyStatus.NOT_APPLIED;
  } else if (buildState.lastAppliedHash === currentHash) {
    applyStatus = ApplyStatus.APPLIED;
  } else {
    applyStatus = ApplyStatus.PENDING;
    applyMessage = 'Changes not applied to database';
  }

  // Final template state
  let state = TemplateState.UNREGISTERED;

  if (isWip) {
    state = TemplateState.WIP;
  } else if (applyStatus === ApplyStatus.APPLIED) {
    state = TemplateState.REGISTERED;
  } else if (buildStatus === BuildStatus.MODIFIED || applyStatus === ApplyStatus.PENDING) {
    state = TemplateState.MODIFIED;
  }

  return {
    state,
    buildStatus,
    applyStatus,
    currentHash,
    buildMessage,
    applyMessage,
  };
}

export const getBuildStatusColor = (status: BuildStatus): string => {
  switch (status) {
    case BuildStatus.BUILT:
      return 'green';
    case BuildStatus.MODIFIED:
      return 'yellow';
    case BuildStatus.ERROR:
      return 'red';
    default:
      return 'gray'; // NOT_BUILT
  }
};

export const getApplyStatusColor = (status: ApplyStatus): string => {
  switch (status) {
    case ApplyStatus.APPLIED:
      return 'green';
    case ApplyStatus.PENDING:
      return 'yellow';
    case ApplyStatus.ERROR:
      return 'red';
    default:
      return 'gray'; // NOT_APPLIED
  }
};

export const getBuildStatusIcon = (status: BuildStatus) => {
  switch (status) {
    case BuildStatus.BUILT:
      return '✓ Built';
    case BuildStatus.MODIFIED:
      return '⚠️ Modified';
    case BuildStatus.ERROR:
      return '❌ Failed';
    default:
      return '- Not Built';
  }
};

export const getApplyStatusIcon = (status: ApplyStatus) => {
  switch (status) {
    case ApplyStatus.APPLIED:
      return '✓ Applied';
    case ApplyStatus.PENDING:
      return '⚠️ Pending';
    case ApplyStatus.ERROR:
      return '❌ Failed';
    default:
      return '- Not Applied';
  }
};
