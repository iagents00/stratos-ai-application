import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const identity = JSON.parse(readFileSync('project-identity.json', 'utf8'));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
let commit = process.env.VERCEL_GIT_COMMIT_SHA || null;
let dirty = null;
try {
  commit ||= git('rev-parse', 'HEAD');
  dirty = !!git('status', '--porcelain', '--untracked-files=normal');
} catch { /* CLI uploads omit .git; promotion also verifies deployment metadata. */ }
writeFileSync('dist/release.json', JSON.stringify({
  project: identity.vercelProjectName,
  projectId: identity.vercelProjectId,
  repository: 'iagents00/stratos-ai-application',
  commit, dirty, builtAt: new Date().toISOString(),
}, null, 2) + '\n');
