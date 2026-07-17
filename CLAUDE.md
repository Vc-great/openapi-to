# Claude Code repository guidance

Read and follow [AGENTS.md](AGENTS.md); it is the authoritative repository guide.

Project Skills are mirrored from the single authoritative source `.agents/skills/` into `.claude/skills/`. Do not edit mirrored Skill content directly. Run `node .agents/scripts/sync-claude-skills.mjs` to check drift or add `--sync` to intentionally refresh the mirror.

When Skill invocation is unavailable, read the applicable canonical `.agents/skills/<skill-name>/SKILL.md` and execute that workflow directly.
