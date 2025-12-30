# SRTD Workflow Demo - WIP Templates Flow
# Shows: WIP templates for experimentation, promote when ready
# Place in README after hero demo

Output readme-workflow-demo.gif

Require srtd

Set FontSize 16
Set Width 1000
Set Height 550
Set TypingSpeed 35ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set LoopOffset 20%

# ============================================================
# SCENE 1: Show WIP concept
# ============================================================

Type "# Experimenting? Use .wip.sql - applies locally, never builds"
Enter
Sleep 2s

# Create a WIP template
Type "cat > supabase/migrations-templates/experiment.wip.sql << 'EOF'"
Enter
Type "CREATE OR REPLACE FUNCTION public.my_experiment()"
Enter
Type "RETURNS text LANGUAGE sql AS $$ SELECT 'testing'; $$;"
Enter
Type "EOF"
Enter
Sleep 500ms

# ============================================================
# SCENE 2: Apply and show it works locally
# ============================================================

Type "srtd apply"
Enter
Sleep 2s

# ============================================================
# SCENE 3: Try to build - WIP is excluded
# ============================================================

Type "srtd build"
Enter
Sleep 2s

# ============================================================
# SCENE 4: Promote when ready
# ============================================================

Type "# Ready to ship? Promote it:"
Enter
Sleep 1s

Type "srtd promote experiment.wip.sql"
Enter
Sleep 2s

# ============================================================
# SCENE 5: Now it builds
# ============================================================

Type "srtd build"
Enter
Sleep 2.5s

# Show the new migration
Type "ls supabase/migrations/"
Enter
Sleep 2.5s

Enter
Sleep 300ms
Type "# WIP = safe experimentation. Promote = ready for production."
Sleep 2.5s
