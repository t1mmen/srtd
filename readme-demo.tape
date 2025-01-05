# See https://github.com/charmbracelet/vhs
# Generate with `npm run vhs`

Output readme-demo.gif

Require npx

# Setup the terminal
Set FontSize 16
Set Width 1024
Set Height 550
Set TypingSpeed 10ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful

# Initialize SRTD
# Type "clear" Enter
Type "srtd init"
Enter
Sleep 1s
Hide
Sleep 2s
Ctrl+C
Show
Sleep 250ms

# Create our first templates
Type "echo '-- SQL for hello..' >> supabase/migrations-templates/hello.sql"
Enter
Sleep 50ms
Type "echo '-- More fake SQL..' >> supabase/migrations-templates/test.sql"
Enter
Sleep 50ms
Type "echo '-- Another one...' >> supabase/migrations-templates/another_test.sql"
Enter
Sleep 50ms
Type "echo '-- WIP SQL here..' >> supabase/migrations-templates/experiment.wip.sql"
Enter
Sleep 50ms
Enter

# Apply changes directly
Type "srtd apply" Enter
Hide
Sleep 2
Show
Sleep 2s
Hide
Sleep 1s
Ctrl+C
Show

# More templates
Type "echo '-- Changes to existing template' >> supabase/migrations-templates/hello.sql" Enter
Sleep 50ms
Type "echo '-- New template' >> supabase/migrations-templates/new.sql" Enter
Sleep 1s

# Start watching for changes
Type "srtd watch"
Sleep 1s
Enter
Hide
Sleep 1s
Show
Sleep 5s
Hide
Ctrl+C
Enter
Show
Sleep 1s

# Build migration files
Type "srtd build"
Sleep 100ms
Enter
Hide
Sleep 2
Enter
Show
Sleep 3s

# Make a change to hello.sql
Type "echo '-- Another update to hello' >> supabase/migrations-templates/hello.sql" Enter
Enter
Sleep 1s

# Build migration files
Type "srtd build" Enter
Sleep 3s
Hide
Ctrl+C
Show

# Promote the WIP template
Type "srtd promote experiment.wip.sql"
Enter
Hide
Sleep 1s
Show
Sleep 2s

# Build migration files
Type "srtd build" Enter
Sleep 3s
Hide
Ctrl+C
Show

# Show the resulting files
Type "ls -1p supabase/migrations/"
Enter
Hide
Enter
Show
Sleep 1s

# Success message
Enter
Type "✨ Thanks for watching! Check out github.com/t1mmen/srtd for more info"
Sleep 5s
