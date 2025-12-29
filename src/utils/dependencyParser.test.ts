import { describe, expect, it } from 'vitest';
import { extractDeclarations, extractReferences, stripSqlNoise } from './dependencyParser.js';

describe('extractDeclarations', () => {
  it('extracts CREATE TABLE declaration', () => {
    const sql = 'CREATE TABLE users (id INT);';
    const result = extractDeclarations(sql);
    expect(result).toEqual([{ type: 'table', name: 'users' }]);
  });

  it('extracts CREATE TABLE IF NOT EXISTS declaration', () => {
    const sql = 'CREATE TABLE IF NOT EXISTS users (id INT);';
    const result = extractDeclarations(sql);
    expect(result).toEqual([{ type: 'table', name: 'users' }]);
  });

  it('extracts CREATE OR REPLACE VIEW declaration', () => {
    const sql = 'CREATE OR REPLACE VIEW active_users AS SELECT * FROM users;';
    const result = extractDeclarations(sql);
    expect(result).toEqual([{ type: 'view', name: 'active_users' }]);
  });

  it('extracts CREATE MATERIALIZED VIEW declaration', () => {
    const sql = 'CREATE MATERIALIZED VIEW stats AS SELECT COUNT(*) FROM users;';
    const result = extractDeclarations(sql);
    expect(result).toEqual([{ type: 'view', name: 'stats' }]);
  });

  it('extracts CREATE FUNCTION declaration', () => {
    const sql =
      'CREATE OR REPLACE FUNCTION get_user(id INT) RETURNS users AS $$ SELECT * FROM users WHERE id = $1; $$;';
    const result = extractDeclarations(sql);
    expect(result).toEqual([{ type: 'function', name: 'get_user' }]);
  });

  it('extracts CREATE TRIGGER declaration', () => {
    const sql =
      'CREATE TRIGGER update_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_timestamp();';
    const result = extractDeclarations(sql);
    expect(result).toEqual([{ type: 'trigger', name: 'update_timestamp' }]);
  });

  it('extracts CREATE POLICY declaration', () => {
    const sql = 'CREATE POLICY users_policy ON users FOR SELECT USING (true);';
    const result = extractDeclarations(sql);
    expect(result).toEqual([{ type: 'policy', name: 'users_policy' }]);
  });

  it('handles schema-qualified names', () => {
    const sql = 'CREATE TABLE public.users (id INT);';
    const result = extractDeclarations(sql);
    expect(result).toEqual([{ type: 'table', name: 'public.users' }]);
  });

  it('extracts multiple declarations from one file', () => {
    const sql = `
      CREATE TABLE users (id INT);
      CREATE TABLE posts (id INT, user_id INT);
    `;
    const result = extractDeclarations(sql);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ type: 'table', name: 'users' });
    expect(result).toContainEqual({ type: 'table', name: 'posts' });
  });

  it('handles case-insensitive SQL keywords', () => {
    const sql = 'create table Users (id INT);';
    const result = extractDeclarations(sql);
    expect(result).toEqual([{ type: 'table', name: 'Users' }]);
  });

  it('returns empty array for SQL without declarations', () => {
    const sql = 'SELECT * FROM users;';
    const result = extractDeclarations(sql);
    expect(result).toEqual([]);
  });
});

describe('extractReferences', () => {
  it('extracts FROM clause references', () => {
    const sql = 'SELECT * FROM users WHERE active = true;';
    const result = extractReferences(sql);
    expect(result).toContain('users');
  });

  it('extracts multiple FROM clause references', () => {
    const sql = 'SELECT * FROM users, posts WHERE users.id = posts.user_id;';
    const result = extractReferences(sql);
    expect(result).toContain('users');
    expect(result).toContain('posts');
  });

  it('extracts JOIN clause references', () => {
    const sql = 'SELECT * FROM users u JOIN posts p ON u.id = p.user_id;';
    const result = extractReferences(sql);
    expect(result).toContain('users');
    expect(result).toContain('posts');
  });

  it('extracts LEFT/RIGHT/INNER JOIN references', () => {
    const sql = `
      SELECT * FROM users u
      LEFT JOIN posts p ON u.id = p.user_id
      INNER JOIN comments c ON p.id = c.post_id;
    `;
    const result = extractReferences(sql);
    expect(result).toContain('users');
    expect(result).toContain('posts');
    expect(result).toContain('comments');
  });

  it('extracts REFERENCES in foreign key', () => {
    const sql = 'CREATE TABLE posts (user_id INT REFERENCES users(id));';
    const result = extractReferences(sql);
    expect(result).toContain('users');
  });

  it('extracts schema-qualified references', () => {
    const sql = 'SELECT * FROM public.users;';
    const result = extractReferences(sql);
    expect(result).toContain('public.users');
  });

  it('excludes declarations from references', () => {
    const sql = 'CREATE TABLE users (id INT);';
    const declarations = extractDeclarations(sql);
    const references = extractReferences(sql, declarations);
    expect(references).not.toContain('users');
  });

  it('excludes view declarations from references in view definition', () => {
    const sql = 'CREATE VIEW active_users AS SELECT * FROM users WHERE active = true;';
    const declarations = extractDeclarations(sql);
    const references = extractReferences(sql, declarations);
    expect(references).not.toContain('active_users');
    expect(references).toContain('users');
  });

  it('returns empty array for SQL without references', () => {
    const sql = 'CREATE TABLE users (id INT, name TEXT);';
    const declarations = extractDeclarations(sql);
    const references = extractReferences(sql, declarations);
    expect(references).toEqual([]);
  });

  it('deduplicates repeated references', () => {
    const sql = `
      SELECT * FROM users u1
      JOIN users u2 ON u1.manager_id = u2.id;
    `;
    const result = extractReferences(sql);
    expect(result.filter(r => r === 'users')).toHaveLength(1);
  });
});

describe('stripSqlNoise', () => {
  it('removes single-line comments', () => {
    const sql = 'SELECT * FROM users; -- comment';
    const result = stripSqlNoise(sql);
    expect(result).not.toContain('comment');
    expect(result).toContain('SELECT');
    expect(result).toContain('users');
  });

  it('removes multi-line comments', () => {
    const sql = 'SELECT * /* comment */ FROM users;';
    const result = stripSqlNoise(sql);
    expect(result).not.toContain('comment');
    expect(result).toContain('SELECT');
    expect(result).toContain('users');
  });

  it('removes multi-line comments spanning lines', () => {
    const sql = `SELECT *
/* this is a
   multi-line
   comment */
FROM users;`;
    const result = stripSqlNoise(sql);
    expect(result).not.toContain('multi-line');
    expect(result).toContain('SELECT');
    expect(result).toContain('users');
  });

  it('replaces single-quoted strings with empty strings', () => {
    const sql = "SELECT 'FROM users' AS text FROM posts;";
    const result = stripSqlNoise(sql);
    expect(result).not.toContain('FROM users');
    expect(result).toContain('posts');
  });

  it('handles escaped quotes in strings', () => {
    const sql = "SELECT 'it''s a test' AS text FROM posts;";
    const result = stripSqlNoise(sql);
    expect(result).not.toContain("it's");
    expect(result).toContain('posts');
  });
});

describe('extractDeclarations with comments/strings', () => {
  it('ignores declarations in single-line comments', () => {
    const sql = `
      -- CREATE TABLE fake_table (id INT);
      CREATE TABLE real_table (id INT);
    `;
    const result = extractDeclarations(sql);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('real_table');
  });

  it('ignores declarations in multi-line comments', () => {
    const sql = `
      /* CREATE TABLE fake_table (id INT); */
      CREATE TABLE real_table (id INT);
    `;
    const result = extractDeclarations(sql);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('real_table');
  });

  it('ignores declarations mentioned in strings', () => {
    const sql = `
      CREATE TABLE logs (message TEXT DEFAULT 'CREATE TABLE users');
    `;
    const result = extractDeclarations(sql);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('logs');
  });
});

describe('extractReferences with comments/strings', () => {
  it('ignores references in single-line comments', () => {
    const sql = `
      -- FROM fake_table
      SELECT * FROM real_table;
    `;
    const result = extractReferences(sql);
    expect(result).toContain('real_table');
    expect(result).not.toContain('fake_table');
  });

  it('ignores references in multi-line comments', () => {
    const sql = `
      /* SELECT * FROM fake_table; */
      SELECT * FROM real_table;
    `;
    const result = extractReferences(sql);
    expect(result).toContain('real_table');
    expect(result).not.toContain('fake_table');
  });

  it('ignores references mentioned in strings', () => {
    const sql = `
      SELECT 'FROM fake_table' AS label FROM real_table;
    `;
    const result = extractReferences(sql);
    expect(result).toContain('real_table');
    expect(result).not.toContain('fake_table');
  });

  it('handles SQL with complex comments and strings', () => {
    const sql = `
      -- This function references users
      CREATE FUNCTION get_data() RETURNS TABLE AS $$
        /* Old code: SELECT * FROM old_users; */
        SELECT id, 'FROM somewhere' as source
        FROM users
        WHERE active = true;
      $$;
    `;
    const declarations = extractDeclarations(sql);
    const references = extractReferences(sql, declarations);
    expect(references).toContain('users');
    expect(references).not.toContain('old_users');
    expect(references).not.toContain('somewhere');
  });
});
