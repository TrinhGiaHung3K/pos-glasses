const assert = require("node:assert/strict");
const test = require("node:test");
const { splitStatements } = require("../../src/db/migrationRunner");

test("migration splitter keeps statements that follow SQL comments", () => {
    const statements = splitStatements(`
        -- migration description
        CREATE TABLE demo (id INT);
        -- data seed
        INSERT INTO demo (id) VALUES (1);
    `);
    assert.equal(statements.length, 2);
    assert.match(statements[0], /^CREATE TABLE demo/);
    assert.match(statements[1], /^INSERT INTO demo/);
});
