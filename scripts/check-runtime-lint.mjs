import { ESLint } from 'eslint';
const results = await new ESLint().lintFiles(['src', 'api']);
const blocking = results.flatMap(file => file.messages
  .filter(message => message.fatal || ['no-undef', 'react-hooks/rules-of-hooks'].includes(message.ruleId))
  .map(message => `${file.filePath}:${message.line} ${message.message}`));
if (blocking.length) { console.error(blocking.join('\n')); process.exitCode = 1; }
else console.log('Sin referencias indefinidas, errores de sintaxis ni hooks condicionales en src y api.');
const other = results.reduce((total, file) => total + file.errorCount + file.warningCount, 0) - blocking.length;
console.log(`${other} avisos de lint adicionales; npm run lint conserva el informe completo.`);
