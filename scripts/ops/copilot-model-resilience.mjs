/** Keep Copilot responsive when several messages share the OpenAI TPM window. */
export function patchModelResilience(nodes) {
  const next = structuredClone(nodes);
  const required = name => {
    const matches = next.filter(node => node.name === name);
    if (matches.length !== 1) throw new Error(`Expected one node named ${name}.`);
    return matches[0];
  };

  for (const name of ['Intérprete', 'AI Agent', 'Agente Actividades']) {
    const node = required(name);
    node.retryOnFail = true;
    node.maxTries = 2;
    node.waitBetweenTries = 2000;
  }

  required('Postgres Chat Memory').parameters.contextWindowLength = 12;

  // These nodes classify/structure compact JSON; mini has materially higher TPM headroom.
  const interpreterModel = required('Claude (suscripcion)');
  interpreterModel.parameters.model = { ...interpreterModel.parameters.model, value: 'gpt-4o-mini', cachedResultName: 'gpt-4o-mini' };
  interpreterModel.parameters.options = { ...interpreterModel.parameters.options, maxTokens: 600 };
  const classifierModel = required('OpenAI Chat Model');
  classifierModel.parameters.model = { ...classifierModel.parameters.model, value: 'gpt-4o-mini', cachedResultName: 'gpt-4o-mini' };
  classifierModel.parameters.options = { ...classifierModel.parameters.options, maxTokens: 1000 };
  return next;
}
