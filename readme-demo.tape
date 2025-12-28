# See https://github.com/charmbracelet/vhs
# Generate with `npm run vhs`

Output readme-demo.gif

# Uncomment to generate PNG frames for review:
# Output demo-frames/

Require npx

# Setup the terminal
Set FontSize 16
Set Width 1024
Set Height 550
Set TypingSpeed 10ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful

# Initialize SRTD
Type "srtd init"
Enter
Sleep 1s
Hide
Sleep 2s
Ctrl+C
Show
Sleep 250ms

# Show the templates we have
Type "ls supabase/migrations-templates/"
Enter
Sleep 1s

# Apply templates to local database
Type "srtd apply"
Enter
Hide
Sleep 2
Show
Sleep 2s
Hide
Sleep 1s
Ctrl+C
Show

# Make a change to a template (add a simple comment to trigger change detection)
Type "echo '' >> supabase/migrations-templates/srtd_demo_greet.sql"
Enter
Sleep 50ms
Type "echo '-- Updated: added logging' >> supabase/migrations-templates/srtd_demo_greet.sql"
Enter
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

# Create a WIP template
Type "echo '-- Work in progress feature' > supabase/migrations-templates/srtd_demo_feature.wip.sql"
Enter
Sleep 1s

# Build again to show WIP is skipped
Type "srtd build"
Enter
Sleep 3s
Hide
Ctrl+C
Show

# Promote the WIP template
Type "srtd promote srtd_demo_feature.wip.sql"
Enter
Hide
Sleep 1s
Show
Sleep 2s

# Build after promotion
Type "srtd build"
Enter
Sleep 3s
Hide
Ctrl+C
Show

# Show the resulting migration files
Type "ls -1p supabase/migrations/"
Enter
Hide
Enter
Show
Sleep 1s

# Success message
Enter
Type "# Thanks for watching! github.com/t1mmen/srtd"
Sleep 5s
