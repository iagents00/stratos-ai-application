import { ESLint } from 'eslint';

// Legacy style rules remain separate; undefined names can crash a screen.
const results = await new ESLint().lintFiles(['src']);
const failures = results.flatMap(result => result.messages
  .filter(message => message.fatal || message.ruleId === 'no-undef')
  .map(message => `${result.filePath}:${message.line}: ${message.message}`));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('Referencias de ejecución verificadas.');
