module.exports = {
  servers: [
    {
      name: 'fixture',
      input: { path: 'packages/mcp/src/fixtures/valid.yaml' },
      output: { dir: 'mcp-codex-smoke' },
    },
  ],
  plugins: [
    {
      name: 'mcp-codex-smoke',
      hooks: {
        buildStart(ctx) {
          ctx.addArtifact({
            kind: 'text',
            path: `${ctx.openapiToSingleConfig.output.dir}/fixture.txt`,
            content: 'bounded Codex MCP smoke fixture\n',
          })
        },
      },
    },
  ],
}
