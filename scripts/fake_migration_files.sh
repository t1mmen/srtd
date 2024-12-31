#!/bin/bash

TEMPLATE_DIR="supabase/migrations-templates"
mkdir -p "$TEMPLATE_DIR"

for i in $(seq -w 1 100); do
    filename="${TEMPLATE_DIR}/template_${i}.sql"
    echo "-- nothing here" > "$filename"
done

echo "Created 100 template files in $TEMPLATE_DIR"
