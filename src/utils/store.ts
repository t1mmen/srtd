// src/utils/store.ts
import Conf from 'conf';

export const store = new Conf({
  projectName: 'srtd',
  defaults: {
    debugEnabled: false,
    showWatchLogs: false,
  },
});
