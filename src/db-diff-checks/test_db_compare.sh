#!/bin/bash

# Configuration
DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"
SCRIPT_DIR="./scripts/db-diff-checks"
COMPARE_SCRIPT="${SCRIPT_DIR}/compare_db_state.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name=$1
    local setup_sql=$2
    local cleanup_sql=$3
    local object_type=$4

    echo -e "${BLUE}Running test: ${test_name}${NC}"

    # Take initial snapshot
    $COMPARE_SCRIPT before > /dev/null 2>&1

    # Apply changes
    echo "$setup_sql" | psql "$DB_URL" > /dev/null 2>&1

    # Compare states
    $COMPARE_SCRIPT after > test_output.txt 2>&1

    # Look for any changes in the specified object type
    if grep -q "=== Comparing ${object_type} ===" test_output.txt && \
       grep -A 1 "=== Comparing ${object_type} ===" test_output.txt | grep -q "! Changes detected"; then
        echo -e "${GREEN}✓ Test passed: Changes detected in ${object_type}${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ Test failed: No changes detected in ${object_type}${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "Test output:"
        cat test_output.txt
    fi
    echo

    # Cleanup
    echo "$cleanup_sql" | psql "$DB_URL" > /dev/null 2>&1
    rm -f test_output.txt
}

# Core Functionality Tests
run_test "RLS Policy - Role Changes" \
"ALTER POLICY \"tools:authenticated:-r--\" ON public.tools TO authenticated, service_role, anon;" \
"ALTER POLICY \"tools:authenticated:-r--\" ON public.tools TO authenticated, anon;" \
"rls"

run_test "RLS Policy - Condition Changes" \
"CREATE POLICY test_policy ON public.tools FOR SELECT USING (true);
ALTER POLICY test_policy ON public.tools USING (false);" \
"DROP POLICY test_policy ON public.tools;" \
"rls"

run_test "RLS Policy - Command Changes" \
"CREATE POLICY test_policy ON public.tools FOR SELECT USING (true);
DROP POLICY test_policy ON public.tools;
CREATE POLICY test_policy ON public.tools FOR INSERT WITH CHECK (true);" \
"DROP POLICY test_policy ON public.tools;" \
"rls"

# Function Tests
run_test "Function - Basic Creation" \
"CREATE OR REPLACE FUNCTION public.test_func() RETURNS trigger AS \$\$
BEGIN
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;" \
"DROP FUNCTION IF EXISTS public.test_func();" \
"functions"

run_test "Function - Argument Changes" \
"CREATE OR REPLACE FUNCTION public.test_func(arg1 text) RETURNS void AS \$\$
BEGIN
    NULL;
END;
\$\$ LANGUAGE plpgsql;
DROP FUNCTION public.test_func(text);
CREATE OR REPLACE FUNCTION public.test_func(arg1 text, arg2 int) RETURNS void AS \$\$
BEGIN
    NULL;
END;
\$\$ LANGUAGE plpgsql;" \
"DROP FUNCTION IF EXISTS public.test_func(text, int);" \
"functions"

run_test "Function - Return Type Changes" \
"CREATE OR REPLACE FUNCTION public.test_func() RETURNS text AS \$\$
BEGIN
    RETURN 'test';
END;
\$\$ LANGUAGE plpgsql;" \
"DROP FUNCTION IF EXISTS public.test_func();" \
"functions"

run_test "Function - Body Changes" \
"CREATE OR REPLACE FUNCTION public.test_func() RETURNS text AS \$\$
BEGIN
    RETURN 'test1';
END;
\$\$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.test_func() RETURNS text AS \$\$
BEGIN
    RETURN 'test2';
END;
\$\$ LANGUAGE plpgsql;" \
"DROP FUNCTION IF EXISTS public.test_func();" \
"functions"

run_test "Function - Language Changes" \
"CREATE OR REPLACE FUNCTION public.test_func() RETURNS text AS \$\$
BEGIN
    RETURN 'test';
END;
\$\$ LANGUAGE plpgsql;
DROP FUNCTION public.test_func();
CREATE OR REPLACE FUNCTION public.test_func() RETURNS text AS \$\$
    SELECT 'test'
\$\$ LANGUAGE sql;" \
"DROP FUNCTION IF EXISTS public.test_func();" \
"functions"

run_test "Function - Volatility Changes" \
"CREATE OR REPLACE FUNCTION public.test_func() RETURNS text VOLATILE AS \$\$
BEGIN
    RETURN 'test';
END;
\$\$ LANGUAGE plpgsql;
DROP FUNCTION public.test_func();
CREATE OR REPLACE FUNCTION public.test_func() RETURNS text IMMUTABLE AS \$\$
BEGIN
    RETURN 'test';
END;
\$\$ LANGUAGE plpgsql;" \
"DROP FUNCTION IF EXISTS public.test_func();" \
"functions"

run_test "Function - Comment Changes" \
"CREATE OR REPLACE FUNCTION public.test_func() RETURNS void AS \$\$
BEGIN
    NULL;
END;
\$\$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.test_func() IS 'Initial comment';" \
"DROP FUNCTION IF EXISTS public.test_func();" \
"functions"

# Enum Tests
run_test "Enum - Basic Creation" \
"CREATE TYPE public.test_enum AS ENUM ('value1', 'value2');" \
"DROP TYPE IF EXISTS public.test_enum;" \
"enums"

run_test "Enum - Add Value" \
"CREATE TYPE public.test_enum AS ENUM ('value1', 'value2');
ALTER TYPE public.test_enum ADD VALUE 'value3';" \
"DROP TYPE IF EXISTS public.test_enum;" \
"enums"

run_test "Enum - Recreate With Different Values" \
"CREATE TYPE public.test_enum AS ENUM ('value1', 'value2');
DROP TYPE public.test_enum;
CREATE TYPE public.test_enum AS ENUM ('value3', 'value4');" \
"DROP TYPE IF EXISTS public.test_enum;" \
"enums"

# Table Tests
run_test "Table - Column Addition" \
"CREATE TABLE public.test_table (id int);
ALTER TABLE public.test_table ADD COLUMN name text;" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

run_test "Table - Column Type Change" \
"CREATE TABLE public.test_table (id int);
ALTER TABLE public.test_table ALTER COLUMN id TYPE bigint;" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

run_test "Table - Default Value Changes" \
"CREATE TABLE public.test_table (id int DEFAULT 0);
ALTER TABLE public.test_table ALTER COLUMN id SET DEFAULT 1;" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

run_test "Table - Constraint Addition" \
"CREATE TABLE public.test_table (id int);
ALTER TABLE public.test_table ADD CONSTRAINT test_check CHECK (id > 0);" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

run_test "Table - Primary Key Changes" \
"CREATE TABLE public.test_table (id int, name text);
ALTER TABLE public.test_table ADD PRIMARY KEY (id);
ALTER TABLE public.test_table DROP CONSTRAINT test_table_pkey;
ALTER TABLE public.test_table ADD PRIMARY KEY (id, name);" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

# Trigger Tests
run_test "Trigger - Basic Creation" \
"CREATE OR REPLACE FUNCTION public.test_trigger_func() RETURNS trigger AS \$\$ BEGIN RETURN NEW; END; \$\$ LANGUAGE plpgsql;
CREATE TRIGGER test_trigger AFTER INSERT ON public.tools FOR EACH ROW EXECUTE FUNCTION public.test_trigger_func();" \
"DROP TRIGGER IF EXISTS test_trigger ON public.tools; DROP FUNCTION IF EXISTS public.test_trigger_func();" \
"triggers"

run_test "Trigger - Condition Changes" \
"CREATE OR REPLACE FUNCTION public.test_trigger_func() RETURNS trigger AS \$\$ BEGIN RETURN NEW; END; \$\$ LANGUAGE plpgsql;
CREATE TRIGGER test_trigger AFTER INSERT ON public.tools FOR EACH ROW WHEN (true) EXECUTE FUNCTION public.test_trigger_func();
DROP TRIGGER test_trigger ON public.tools;
CREATE TRIGGER test_trigger AFTER INSERT ON public.tools FOR EACH ROW WHEN (false) EXECUTE FUNCTION public.test_trigger_func();" \
"DROP TRIGGER IF EXISTS test_trigger ON public.tools; DROP FUNCTION IF EXISTS public.test_trigger_func();" \
"triggers"

# View Tests
run_test "View - Basic Creation" \
"CREATE VIEW public.test_view AS SELECT 1 as num;" \
"DROP VIEW IF EXISTS public.test_view;" \
"views"

run_test "View - Definition Changes" \
"CREATE VIEW public.test_view AS SELECT 1 as num;
CREATE OR REPLACE VIEW public.test_view AS SELECT 2 as num;" \
"DROP VIEW IF EXISTS public.test_view;" \
"views"

run_test "View - Column Names" \
"CREATE VIEW public.test_view AS SELECT 1 as num;
DROP VIEW public.test_view;
CREATE VIEW public.test_view AS SELECT 1 as different_name;" \
"DROP VIEW IF EXISTS public.test_view;" \
"views"

# Index Tests
run_test "Index - Basic Creation" \
"CREATE TABLE IF NOT EXISTS public.test_table (name text);
CREATE INDEX test_idx ON public.test_table (name);" \
"DROP TABLE IF EXISTS public.test_table CASCADE;" \
"indexes"

run_test "Index - Expression Changes" \
"CREATE TABLE IF NOT EXISTS public.test_table (name text);
CREATE INDEX test_idx ON public.test_table (lower(name));" \
"DROP TABLE IF EXISTS public.test_table CASCADE;" \
"indexes"

run_test "Index - Type Changes" \
"CREATE TABLE IF NOT EXISTS public.test_table (name text);
CREATE INDEX test_idx ON public.test_table USING hash (name);" \
"DROP TABLE IF EXISTS public.test_table CASCADE;" \
"indexes"

# Comment Tests
run_test "Comment - Table Comments" \
"CREATE TABLE public.test_table (id int);
COMMENT ON TABLE public.test_table IS 'First comment';
COMMENT ON TABLE public.test_table IS 'Changed comment';" \
"DROP TABLE IF EXISTS public.test_table;" \
"comments"

run_test "Comment - Column Comments" \
"CREATE TABLE public.test_table (id int);
COMMENT ON COLUMN public.test_table.id IS 'First comment';" \
"DROP TABLE IF EXISTS public.test_table CASCADE;" \
"tables"

run_test "Comment - Function Comments" \
"CREATE OR REPLACE FUNCTION public.test_func() RETURNS void AS \$\$ BEGIN NULL; END; \$\$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.test_func() IS 'First comment';
DROP FUNCTION public.test_func();
CREATE OR REPLACE FUNCTION public.test_func() RETURNS void AS \$\$ BEGIN NULL; END; \$\$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.test_func() IS 'Changed comment';" \
"DROP FUNCTION IF EXISTS public.test_func();" \
"functions"

# Sequence Tests
run_test "Sequence - Basic Creation" \
"CREATE SEQUENCE public.test_seq;" \
"DROP SEQUENCE IF EXISTS public.test_seq;" \
"sequences"

run_test "Sequence - Properties Change" \
"CREATE SEQUENCE public.test_seq;
ALTER SEQUENCE public.test_seq INCREMENT BY 2 MINVALUE 0 MAXVALUE 100 RESTART WITH 10 CYCLE;" \
"DROP SEQUENCE IF EXISTS public.test_seq;" \
"sequences"

run_test "Sequence - Ownership Change" \
"CREATE SEQUENCE public.test_seq;
CREATE TABLE public.test_table (id int);
ALTER SEQUENCE public.test_seq OWNED BY public.test_table.id;" \
"DROP TABLE IF EXISTS public.test_table CASCADE; DROP SEQUENCE IF EXISTS public.test_seq;" \
"sequences"

# Additional View Tests
run_test "View - Materialized View Creation" \
"CREATE MATERIALIZED VIEW public.test_matview AS SELECT 1 as num;" \
"DROP MATERIALIZED VIEW IF EXISTS public.test_matview;" \
"views"

run_test "View - Permission Changes" \
"CREATE VIEW public.test_view AS SELECT 1 as num;
GRANT SELECT ON public.test_view TO authenticated;
REVOKE SELECT ON public.test_view FROM authenticated;" \
"DROP VIEW IF EXISTS public.test_view;" \
"views"

# Additional RLS Tests
run_test "RLS Policy - Permissive to Restrictive" \
"CREATE POLICY test_policy ON public.tools AS PERMISSIVE FOR SELECT USING (true);
DROP POLICY test_policy ON public.tools;
CREATE POLICY test_policy ON public.tools AS RESTRICTIVE FOR SELECT USING (true);" \
"DROP POLICY IF EXISTS test_policy ON public.tools;" \
"rls"

run_test "RLS Policy - With Check Changes" \
"CREATE POLICY test_policy ON public.tools FOR INSERT WITH CHECK (true);
ALTER POLICY test_policy ON public.tools WITH CHECK (false);" \
"DROP POLICY IF EXISTS test_policy ON public.tools;" \
"rls"

# Additional Table Tests
run_test "Table - Foreign Key Addition" \
"CREATE TABLE public.test_parent (id int PRIMARY KEY);
CREATE TABLE public.test_child (parent_id int);
ALTER TABLE public.test_child ADD CONSTRAINT fk_parent
    FOREIGN KEY (parent_id) REFERENCES public.test_parent(id);" \
"DROP TABLE IF EXISTS public.test_child, public.test_parent CASCADE;" \
"tables"

run_test "Table - Unique Constraint" \
"CREATE TABLE public.test_table (id int, code text);
ALTER TABLE public.test_table ADD CONSTRAINT test_unique UNIQUE (code);" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

run_test "Table - Not Null Changes" \
"CREATE TABLE public.test_table (id int NULL);
ALTER TABLE public.test_table ALTER COLUMN id SET NOT NULL;" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

run_test "Table - Multiple Constraints" \
"CREATE TABLE public.test_table (
    id int,
    code text,
    value int
);
ALTER TABLE public.test_table
    ADD PRIMARY KEY (id),
    ADD UNIQUE (code),
    ADD CHECK (value > 0),
    ALTER COLUMN code SET NOT NULL;" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

run_test "Table - Identity Column Changes" \
"CREATE TABLE public.test_table (id int GENERATED ALWAYS AS IDENTITY);
ALTER TABLE public.test_table ALTER COLUMN id SET GENERATED BY DEFAULT;" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

# Storage Parameter Changes
run_test "Table - Storage Parameter Changes" \
"CREATE TABLE public.test_table (id int);
ALTER TABLE public.test_table SET (fillfactor = 70);" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

# Inheritance Tests
run_test "Table - Inheritance Changes" \
"CREATE TABLE public.test_parent (id int);
CREATE TABLE public.test_child () INHERITS (public.test_parent);
ALTER TABLE public.test_child NO INHERIT public.test_parent;" \
"DROP TABLE IF EXISTS public.test_child, public.test_parent;" \
"tables"

# Column Statistics
run_test "Table - Column Statistics" \
"CREATE TABLE public.test_table (id int);
ALTER TABLE public.test_table ALTER COLUMN id SET STATISTICS 100;" \
"DROP TABLE IF EXISTS public.test_table;" \
"tables"

# Print summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}Tests passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests failed: $TESTS_FAILED${NC}"

# Exit with appropriate status
[ $TESTS_FAILED -eq 0 ]
