# SRTD Workflow Demo - WIP Templates Flow
# Shows: WIP templates for experimentation, promote when ready

Output readme-workflow-demo.gif

Require srtd

Set FontSize 16
Set Width 1100
Set Height 550
Set TypingSpeed 35ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set LoopOffset 20%

# ============================================================
# OPENING - gentle start
# ============================================================

Sleep 1.5s

# ============================================================
# SCENE 1: Introduce WIP concept
# ============================================================

Type "# .wip.sql templates: experiment safely without affecting builds"
Enter
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
# SCENE 2: Apply works - instant local testing
# ============================================================

Type "# apply works - test your changes instantly"
Enter
Enter
Sleep 1.5s

Type "srtd apply"
Enter
Sleep 2.5s

# ============================================================
# SCENE 3: Build excludes WIP - safe from accidents
# ============================================================

Type "# build excludes WIP - won't accidentally ship experiments"
Enter
Enter
Sleep 1.5s

Type "srtd build"
Enter
Sleep 2.5s

# ============================================================
# SCENE 4: Promote when ready
# ============================================================

Type "# happy with it? promote to make it buildable"
Enter
Enter
Sleep 1.5s

Type "srtd promote experiment.wip.sql"
Enter
Sleep 2.5s

# ============================================================
# SCENE 5: Now it builds
# ============================================================

Type "# now build generates the migration"
Enter
Enter
Sleep 1.5s

Type "srtd build"
Enter
Sleep 2.5s

# Show the new migration
Type "ls -1 supabase/migrations/"
Enter
Sleep 2.5s

# ============================================================
# SIGN OFF
# ============================================================

Enter
Sleep 500ms
Type "# WIP = safe experimentation. Promote = ready for production."
Sleep 2.5s
