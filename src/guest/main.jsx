// Install the isolation boundary BEFORE evaluating any application module.
import { installGuestBoundary } from './boundary.js';

installGuestBoundary(window);
import('./Workspace.jsx').then(({ mountGuest }) => mountGuest());
