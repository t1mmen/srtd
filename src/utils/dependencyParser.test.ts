import { describe, expect, it } from 'vitest';
import { extractDependsOn } from './dependencyParser.js';

describe('extractDependsOn', () => {
  it('extracts single dependency from comment', () => {
    const sql = `-- @depends-on: base_function.sql
CREATE FUNCTION complex_function() AS $$ ... $$;`;
    const result = extractDependsOn(sql);
    expect(result).toEqual(['base_function.sql']);
  });

  it('extracts multiple comma-separated dependencies', () => {
    const sql = `-- @depends-on: users.sql, permissions.sql, roles.sql
CREATE VIEW active_users AS SELECT * FROM users;`;
    const result = extractDependsOn(sql);
    expect(result).toEqual(['users.sql', 'permissions.sql', 'roles.sql']);
  });

  it('handles multiple @depends-on comments', () => {
    const sql = `-- @depends-on: first.sql
-- @depends-on: second.sql
CREATE FUNCTION foo() AS $$ ... $$;`;
    const result = extractDependsOn(sql);
    expect(result).toEqual(['first.sql', 'second.sql']);
  });

  it('trims whitespace around filenames', () => {
    const sql = `-- @depends-on:   spaced.sql  ,  another.sql
CREATE TABLE test (id INT);`;
    const result = extractDependsOn(sql);
    expect(result).toEqual(['spaced.sql', 'another.sql']);
  });

  it('returns empty array when no @depends-on comment', () => {
    const sql = `CREATE FUNCTION standalone() AS $$ ... $$;`;
    const result = extractDependsOn(sql);
    expect(result).toEqual([]);
  });

  it('ignores @depends-on in multi-line comments', () => {
    const sql = `/* @depends-on: ignored.sql */
CREATE FUNCTION foo() AS $$ ... $$;`;
    const result = extractDependsOn(sql);
    expect(result).toEqual([]);
  });

  it('ignores @depends-on in string literals', () => {
    const sql = `CREATE FUNCTION foo() AS $$
  RETURN '-- @depends-on: fake.sql';
$$;`;
    const result = extractDependsOn(sql);
    expect(result).toEqual([]);
  });

  it('handles case variations', () => {
    const sql = `-- @DEPENDS-ON: upper.sql
-- @Depends-On: mixed.sql
CREATE FUNCTION foo() AS $$ ... $$;`;
    const result = extractDependsOn(sql);
    expect(result).toEqual(['upper.sql', 'mixed.sql']);
  });

  it('deduplicates repeated dependencies', () => {
    const sql = `-- @depends-on: same.sql
-- @depends-on: same.sql, other.sql
CREATE FUNCTION foo() AS $$ ... $$;`;
    const result = extractDependsOn(sql);
    expect(result).toEqual(['same.sql', 'other.sql']);
  });

  it('handles empty @depends-on comment gracefully', () => {
    const sql = `-- @depends-on:
CREATE FUNCTION foo() AS $$ ... $$;`;
    const result = extractDependsOn(sql);
    expect(result).toEqual([]);
  });
});
