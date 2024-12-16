#!/bin/bash

# Configuration
DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"
OUTPUT_DIR="./scripts/db-diff-checks/diffs"
REPORT_DIR="${OUTPUT_DIR}/reports"

# Create output directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$REPORT_DIR"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

generate_markdown_report() {
    local TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    local REPORT_FILE="${REPORT_DIR}/comparison_${TIMESTAMP}.md"
    local HAS_CHANGES=0

    # Create report header
    cat > "$REPORT_FILE" << EOF
# Database State Comparison Report
Generated: $(date)

EOF

    # Add each comparison to the report
    for TYPE in functions enums tables rls triggers views indexes extensions types sequences default_privs comments; do
            echo "## $(echo $TYPE | tr '[:lower:]' '[:upper:]')" >> "$REPORT_FILE"
            if diff --unified "${OUTPUT_DIR}/before_${TYPE}.txt" "${OUTPUT_DIR}/after_${TYPE}.txt" > /dev/null; then
                echo "✓ No changes detected" >> "$REPORT_FILE"
            else
            HAS_CHANGES=1
            echo "⚠️ Changes detected:" >> "$REPORT_FILE"
            echo "\`\`\`diff" >> "$REPORT_FILE"
            diff --unified "${OUTPUT_DIR}/before_${TYPE}.txt" "${OUTPUT_DIR}/after_${TYPE}.txt" | \
                grep -v "^@@" >> "$REPORT_FILE"
            echo "\`\`\`" >> "$REPORT_FILE"
        fi
        echo >> "$REPORT_FILE"
    done

    if [ $HAS_CHANGES -eq 1 ]; then
        echo "Report generated: $REPORT_FILE"
        echo "Opening report..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open "$REPORT_FILE"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open "$REPORT_FILE"
        fi
    else
        rm "$REPORT_FILE"
        echo "No changes detected - no report generated"
    fi
}
compare_states() {
    echo "=== Database State Comparison ==="
    echo

    local HAS_DIFFERENCES=0

    for TYPE in functions enums tables rls triggers views indexes extensions types sequences default_privs comments; do
        echo "=== Comparing $TYPE ==="

        if diff --color=always -u "${OUTPUT_DIR}/before_${TYPE}.txt" "${OUTPUT_DIR}/after_${TYPE}.txt" > /dev/null; then
            echo -e "${GREEN}✓ No changes detected${NC}"
        else
            echo -e "${RED}! Changes detected:${NC}"
            echo
            # Show changes in terminal
            diff --color=always -u "${OUTPUT_DIR}/before_${TYPE}.txt" \
                         "${OUTPUT_DIR}/after_${TYPE}.txt" | \
                grep -v "^@@" | \
                grep -v "^---" | \
                grep -v "^+++"
            HAS_DIFFERENCES=1
        fi
        echo
    done

    # Only generate report if there are differences
    if [ $HAS_DIFFERENCES -eq 1 ]; then
        local TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        local REPORT_FILE="${REPORT_DIR}/comparison_${TIMESTAMP}.md"

        # Create report header
        cat > "$REPORT_FILE" << EOF
# Database State Comparison Report
Generated: $(date)

EOF

        # Add each section to the report
        for TYPE in functions enums tables rls triggers views indexes extensions types sequences default_privs comments; do
            echo "## ${TYPE^}" >> "$REPORT_FILE"
            if diff --unified "${OUTPUT_DIR}/before_${TYPE}.txt" "${OUTPUT_DIR}/after_${TYPE}.txt" > /dev/null; then
                echo "✓ No changes detected" >> "$REPORT_FILE"
            else
                echo "⚠️ Changes detected:" >> "$REPORT_FILE"
                echo "\`\`\`diff" >> "$REPORT_FILE"
                diff --unified "${OUTPUT_DIR}/before_${TYPE}.txt" "${OUTPUT_DIR}/after_${TYPE}.txt" | \
                    grep -v "^@@" >> "$REPORT_FILE"
                echo "\`\`\`" >> "$REPORT_FILE"
            fi
            echo >> "$REPORT_FILE"
        done

        echo "Report generated: $REPORT_FILE"

        # Try to open the report, preferring other editors over Xcode
        if [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v code >/dev/null 2>&1; then
                code "$REPORT_FILE"  # Try VS Code first
            elif command -v subl >/dev/null 2>&1; then
                subl "$REPORT_FILE"  # Try Sublime Text second
            else
                echo "Report available at: $REPORT_FILE"
                # Removed 'open' command to avoid Xcode
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open "$REPORT_FILE" || echo "Report available at: $REPORT_FILE"
        else
            echo "Report available at: $REPORT_FILE"
        fi
    fi
}

dump_state() {
    local PREFIX=$1
    local OUTFILE="$OUTPUT_DIR/${PREFIX}"

    echo "Dumping database state..."

    # Debug: Create empty files first
    for TYPE in functions enums tables rls triggers views indexes extensions types sequences default_privs comments; do
        echo "NO_CONTENT" > "${OUTFILE}_${TYPE}.txt"
    done

# Functions
    psql "$DB_URL" -t -A -c "
        WITH function_comments AS (
            SELECT
                d.objoid,
                d.description
            FROM pg_description d
            JOIN pg_proc p ON p.oid = d.objoid
            WHERE d.objsubid = 0
        )
        SELECT format(
            'FUNCTION: %s.%s(%s)\nRETURN TYPE: %s\nARGUMENTS: %s\nCOMMENT: %s\nVOLATILITY: %s\n%s\n---\n',
            nspname,
            proname,
            pg_get_function_arguments(p.oid),
            pg_get_function_result(p.oid),
            pg_get_function_identity_arguments(p.oid),
            COALESCE(fc.description, '(no comment)'),
            CASE provolatile
                WHEN 'i' THEN 'IMMUTABLE'
                WHEN 's' THEN 'STABLE'
                WHEN 'v' THEN 'VOLATILE'
            END,
            pg_get_functiondef(p.oid)
        )
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        LEFT JOIN function_comments fc ON fc.objoid = p.oid
        WHERE nspname = 'public'
        ORDER BY nspname, proname;" > "${OUTFILE}_functions.txt"

# Enums
    psql "$DB_URL" -t -A -c "
        SELECT format(
            'TYPE: %s (ENUM)\nVALUES:\n%s\n---\n',
            t.typname,
            string_agg(
                format('  - %s', e.enumlabel),
                E'\n' ORDER BY e.enumsortorder
            )
        )
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        GROUP BY t.typname, n.nspname
        ORDER BY t.typname;" > "${OUTFILE}_enums.txt"

# Tables
    psql "$DB_URL" -t -A -c "
        SELECT format(
            'TABLE: %s\n%s\n---\n',
            c.relname,
            pg_catalog.pg_get_tabledef(c.oid)
        )
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        ORDER BY c.relname;" > "${OUTFILE}_tables.txt" 2>/dev/null || \
    # Fallback if pg_get_tabledef is not available
    psql "$DB_URL" -t -A -c "
        SELECT format(
            'TABLE: %s\n%s\n---\n',
            tablename,
            (
                SELECT string_agg(
                    format('%s %s', column_name, data_type),
                    E'\n'
                )
                FROM information_schema.columns c2
                WHERE c2.table_name = c1.tablename
                AND c2.table_schema = 'public'
            )
        )
        FROM pg_tables c1
        WHERE schemaname = 'public'
        ORDER BY tablename;" > "${OUTFILE}_tables.txt"

# RLS Policies
    psql "$DB_URL" -t -A -c "
        WITH policy_roles AS (
            SELECT
                polname,
                relname,
                string_agg(
                    CASE
                        WHEN r.rolname IS NULL THEN 'public'
                        ELSE quote_ident(r.rolname)
                    END,
                    ', ' ORDER BY r.rolname
                ) as grantee_roles
            FROM pg_policy pol
            JOIN pg_class c ON c.oid = pol.polrelid
            LEFT JOIN LATERAL unnest(pol.polroles) AS rid(rid) ON true
            LEFT JOIN pg_roles r ON r.oid = rid.rid
            GROUP BY polname, relname
        )
        SELECT format(
            'POLICY: %s\nON TABLE: %s\nCOMMAND: %s\nROLES: %s\nUSING: %s\nWITH CHECK: %s\n---\n',
            pol.polname,
            c.relname,
            CASE pol.polcmd
                WHEN 'r' THEN 'SELECT'
                WHEN 'a' THEN 'INSERT'
                WHEN 'w' THEN 'UPDATE'
                WHEN 'd' THEN 'DELETE'
                WHEN '*' THEN 'ALL'
            END,
            COALESCE(pr.grantee_roles, 'public'),
            NULLIF(pg_get_expr(pol.polqual, pol.polrelid), ''),
            NULLIF(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
        )
        FROM pg_policy pol
        JOIN pg_class c ON c.oid = pol.polrelid
        LEFT JOIN policy_roles pr ON pr.polname = pol.polname AND pr.relname = c.relname
        WHERE c.relnamespace = 'public'::regnamespace
        ORDER BY c.relname, pol.polname;" > "${OUTFILE}_rls.txt"

# Triggers
    psql "$DB_URL" -t -A -c "
        SELECT format(
            'TRIGGER: %s\nTABLE: %s\nTIMING: %s\nEVENTS: %s\nDEFINITION:\n%s\n---\n',
            tgname,
            relname,
            CASE tgtype & 2
                WHEN 0 THEN 'AFTER'
                ELSE 'BEFORE'
            END,
            string_agg(
                CASE
                    WHEN tgtype & 4 > 0 THEN 'INSERT'
                    WHEN tgtype & 8 > 0 THEN 'DELETE'
                    WHEN tgtype & 16 > 0 THEN 'UPDATE'
                    WHEN tgtype & 32 > 0 THEN 'TRUNCATE'
                END,
                ' OR '
            ),
            pg_get_triggerdef(t.oid)
        )
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE NOT tgisinternal
        AND relnamespace = 'public'::regnamespace
        GROUP BY t.oid, tgname, relname, tgtype
        ORDER BY relname, tgname;" > "${OUTFILE}_triggers.txt"

    # Views
    psql "$DB_URL" -t -A -c "
        WITH view_grants AS (
            SELECT table_name,
                   string_agg(DISTINCT grantee || ': ' || privilege_type, ', ') as grants
            FROM information_schema.role_table_grants
            WHERE table_schema = 'public'
            GROUP BY table_name
        )
        SELECT format(
            'VIEW: %s\nTYPE: %s\nOWNER: %s\nDEFINITION:\n%s\nGRANTS:\n%s\n---\n',
            c.relname,
            CASE c.relkind WHEN 'v' THEN 'VIEW' ELSE 'MATERIALIZED VIEW' END,
            pg_get_userbyid(c.relowner),
            pg_get_viewdef(c.oid),
            COALESCE(g.grants, 'No explicit grants')
        )
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN view_grants g ON g.table_name = c.relname
        WHERE n.nspname = 'public'
        AND c.relkind IN ('v', 'm')
        ORDER BY c.relname;" > "${OUTFILE}_views.txt"

    # Indexes
    psql "$DB_URL" -t -A -c "
        SELECT format(
            'INDEX: %s\nON TABLE: %s\nTYPE: %s\nDEFINITION:\n%s\n---\n',
            i.relname,
            t.relname,
            am.amname,
            pg_get_indexdef(i.oid)
        )
        FROM pg_class i
        JOIN pg_index idx ON idx.indexrelid = i.oid
        JOIN pg_class t ON t.oid = idx.indrelid
        JOIN pg_am am ON am.oid = i.relam
        JOIN pg_namespace n ON n.oid = i.relnamespace
        WHERE n.nspname = 'public'
        AND i.relkind = 'i'
        ORDER BY t.relname, i.relname;" > "${OUTFILE}_indexes.txt"

    # Extensions
    psql "$DB_URL" -t -A -c "
        SELECT format(
            'EXTENSION: %s\nVERSION: %s\nSCHEMA: %s\n---\n',
            extname,
            extversion,
            n.nspname
        )
        FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        ORDER BY extname;" > "${OUTFILE}_extensions.txt"

    # Types
    psql "$DB_URL" -t -A -c "
        SELECT format(
            'TYPE: %s\nCATEGORY: %s\nDEFINITION:\n%s\n---\n',
            t.typname,
            t.typcategory::text,
            pg_catalog.format_type(t.oid, NULL)
        )
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        AND t.typtype NOT IN ('e')
        ORDER BY t.typname;" > "${OUTFILE}_types.txt"

    # Sequences
    psql "$DB_URL" -t -A -c "
        WITH seq_owned AS (
            SELECT
                d.refobjid::regclass AS table_name,
                a.attname AS column_name,
                d.objid::regclass AS sequence_name
            FROM pg_depend d
            JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
            WHERE d.classid = 'pg_class'::regclass
            AND d.refclassid = 'pg_class'::regclass
            AND d.deptype = 'a'
        )
        SELECT format(
            'SEQUENCE: %s\nOWNED BY: %s\nSTART: %s\nINCREMENT: %s\nMIN: %s\nMAX: %s\nCYCLE: %s\n---\n',
            c.relname,
            COALESCE(
                (SELECT format('%s.%s', table_name, column_name)
                FROM seq_owned
                WHERE sequence_name::text = c.relname
                LIMIT 1
            ), 'none'),
            s.seqstart,
            s.seqincrement,
            s.seqmin,
            s.seqmax,
            CASE WHEN s.seqcycle THEN 'yes' ELSE 'no' END
        )
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_sequence s ON s.seqrelid = c.oid
        WHERE n.nspname = 'public'
        AND c.relkind = 'S'
        ORDER BY c.relname;" > "${OUTFILE}_sequences.txt"


    # Default Privileges
    psql "$DB_URL" -t -A -c "
        SELECT format(
            'DEFAULT PRIVILEGE: %s\nGRANTOR: %s\nGRANTEE: %s\nOBJECT TYPE: %s\nPRIVILEGES: %s\n---\n',
            defaclnamespace::regnamespace,
            r1.rolname,
            r2.rolname,
            CASE defaclobjtype
                WHEN 'r' THEN 'TABLE'
                WHEN 'S' THEN 'SEQUENCE'
                WHEN 'f' THEN 'FUNCTION'
                WHEN 'T' THEN 'TYPE'
                WHEN 'n' THEN 'SCHEMA'
            END,
            defaclacl::text
        )
        FROM pg_default_acl d
        JOIN pg_roles r1 ON r1.oid = d.defaclrole
        JOIN pg_roles r2 ON r2.oid = d.defaclrole
        WHERE defaclnamespace::regnamespace::text = 'public'
        ORDER BY defaclobjtype;" > "${OUTFILE}_default_privs.txt"

    # Comments
    psql "$DB_URL" -t -A -c "
        SELECT format(
            'COMMENT ON %s %s: %s\n---\n',
            CASE c.relkind
                WHEN 'r' THEN 'TABLE'
                WHEN 'v' THEN 'VIEW'
                WHEN 'f' THEN 'FOREIGN TABLE'
                WHEN 'i' THEN 'INDEX'
                WHEN 'S' THEN 'SEQUENCE'
                ELSE c.relkind::text
            END,
            c.relname,
            d.description
        )
        FROM pg_description d
        JOIN pg_class c ON c.oid = d.objoid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND d.objsubid = 0
        ORDER BY c.relkind, c.relname;" > "${OUTFILE}_comments.txt"

    # Functions with comments
    psql "$DB_URL" -t -A -c "
        WITH function_comments AS (
            SELECT
                d.objoid,
                d.description
            FROM pg_description d
            JOIN pg_proc p ON p.oid = d.objoid
            WHERE d.objsubid = 0
        )
        SELECT format(
            'FUNCTION: %s.%s\nRETURN TYPE: %s\nCOMMENT: %s\n%s\n---\n',
            nspname,
            proname,
            pg_get_function_result(p.oid),
            COALESCE(fc.description, '(no comment)'),
            pg_get_functiondef(p.oid)
        )
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        LEFT JOIN function_comments fc ON fc.objoid = p.oid
        WHERE nspname = 'public'
        ORDER BY nspname, proname;" > "${OUTFILE}_functions.txt"

    # Touch empty files if they don't exist (for empty results)
    for TYPE in functions enums tables rls triggers views indexes extensions types sequences default_privs comments; do
        touch "${OUTFILE}_${TYPE}.txt"
    done

    echo "✓ State dump completed"
}
case "$1" in
    "before")
        dump_state "before"
        ;;
    "after")
        if [ ! -f "${OUTPUT_DIR}/before_functions.txt" ]; then
            echo "Error: No 'before' state found. Run with 'before' first."
            exit 1
        fi
        dump_state "after" && compare_states
        ;;
    "view")
        if [ ! -f "${OUTPUT_DIR}/before_functions.txt" ]; then
            echo "Error: No states found. Run with 'before' first."
            exit 1
        fi
        less "${OUTPUT_DIR}/before_functions.txt"
        ;;
    *)
        echo "Usage: $0 {before|after|view}"
        echo "  before: Dump initial state before migrations"
        echo "  after:  Dump final state after migrations and show differences"
        echo "  view:   View the current function definitions"
        exit 1
        ;;
esac
