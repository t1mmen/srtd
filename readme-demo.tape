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
Sleep 1.5s

# Breathing room after init
Enter
Sleep 500ms

# Show the templates we have
Type "ls supabase/migrations-templates/"
Enter
Sleep 2s

# Breathing room after ls
Enter
Sleep 500ms

# Apply templates to local database
Type "srtd apply"
Enter
Hide
Sleep 2
Show
Sleep 3s
Hide
Sleep 1s
Ctrl+C
Show

# Breathing room after apply
Enter
Sleep 500ms

# Start watch mode briefly to show the UI
Type "srtd watch"
Enter
Hide
Sleep 2s
Show
Sleep 4s
Hide
Ctrl+C
Show
Sleep 500ms

# Breathing room after watch
Enter
Sleep 500ms

# Build migration files
Type "srtd build"
Enter
Hide
Sleep 2
Show
Sleep 3s

# Breathing room after build - let viewer see "Built 3 templates"
Enter
Sleep 1s

# Create a WIP template
Type "echo '-- Work in progress feature' > supabase/migrations-templates/srtd_demo_feature.wip.sql"
Enter
Sleep 1.5s

# Apply WIP - shows it works locally
Type "srtd apply"
Enter
Hide
Sleep 2
Show
Sleep 3s
Hide
Ctrl+C
Show

# Breathing room after apply
Enter
Sleep 500ms

# Build to show WIP is skipped for migrations
Type "srtd build"
Enter
Sleep 4s
Hide
Ctrl+C
Show

# Breathing room - let viewer see "(wip)" indicator
Enter
Sleep 1s

# Promote the WIP template
Type "srtd promote srtd_demo_feature.wip.sql"
Enter
Hide
Sleep 1s
Show
Sleep 2.5s

# Breathing room after promote
Enter
Sleep 500ms

# Build after promotion
Type "srtd build"
Enter
Sleep 4s
Hide
Ctrl+C
Show

# Breathing room after final build
Enter
Sleep 500ms

# Show the resulting migration files
Type "ls -1p supabase/migrations/"
Enter
Hide
Enter
Show
Sleep 2s

# Breathing room after ls
Enter
Sleep 500ms

# Run doctor to validate setup
Type "srtd doctor"
Enter
Sleep 3s

# Sign off
Enter
Type "✨ Thanks for watching! Check out github.com/t1mmen/srtd for more info"
Sleep 5s
