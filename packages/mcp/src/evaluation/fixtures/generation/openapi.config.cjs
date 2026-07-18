module.exports = {
  servers: [{ name: 'evaluation', input: { path: 'packages/mcp/src/evaluation/fixtures/generation/openapi.json' }, output: { dir: 'mcp-evaluation-output', clean: true } }],
  plugins: [{ name: 'evaluation-artifacts', hooks: { buildStart(ctx) {
    const paths = Object.keys(ctx.openAPIDocument.paths || {}).sort();
    for (const [index, apiPath] of paths.entries()) ctx.addArtifact({ kind: 'text', path: [ctx.openapiToSingleConfig.output.dir, '/operation-', String(index).padStart(4, '0'), '.txt'].join(''), content: [apiPath, '\n'].join('') });
  } } }]
};
