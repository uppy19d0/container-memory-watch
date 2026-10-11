import { startMemoryWatch } from '../../packages/node/index.js';

// In your app: import { startMemoryWatch } from 'container-memory-watch'.
// Container images install the trusted binary at /opt/oom-watch/oom-watch.
export const startMemoryMonitoring = startMemoryWatch;
