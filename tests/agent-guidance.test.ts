import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('routes every agent skill to its canonical Claude skill', () => {
  const names = readdirSync('.claude/skills').sort();
  expect(readdirSync('.agents/skills').sort()).toEqual(names);

  for (const name of names) {
    const source = join('.claude/skills', name, 'SKILL.md');
    const entry = join('.agents/skills', name, 'SKILL.md');
    expect(readFileSync(source, 'utf8')).toContain(`name: ${name}`);
    expect(readFileSync(entry, 'utf8')).toContain(`(../../../.claude/skills/${name}/SKILL.md)`);
  }
});
