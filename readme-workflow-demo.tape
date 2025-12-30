# SRTD Workflow Demo - Full Developer Experience
# Shows: watch mode, WIP templates, dependencies, build
# Place in README after WIP Templates / Dependencies section

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
# SCENE 1: Start watch mode (the daily workflow)
# ============================================================

Type "# Development workflow: watch mode"
Enter
Sleep 1.5s

Type "srtd watch"
Enter
Sleep 3s

# ============================================================
# SCENE 2: Create a WIP template (experimenting)
# ============================================================

# Exit watch to create file
Ctrl+C
Sleep 500ms

Type "# Experimenting? Use .wip.sql - applies locally, never builds"
Enter
Sleep 2s

# Copy the existing get_user_email template as a WIP file
Type "cp demo-templates/srtd_demo_get_user_email.sql supabase/migrations-templates/new_feature.wip.sql"
Enter
Sleep 500ms

Type "srtd watch"
Enter
Sleep 3s

# Show it applied but is marked WIP (never built)
Sleep 2s

# ============================================================
# SCENE 3: Promote WIP when ready
# ============================================================

Ctrl+C
Sleep 500ms

Type "# Ready to ship? Promote it:"
Enter
Sleep 1s

Type "srtd promote new_feature.wip.sql"
Enter
Sleep 2s

# ============================================================
# SCENE 4: Build from watch mode
# ============================================================

Type "srtd watch"
Enter
Sleep 2.5s

Type "# Press 'b' to build migrations"
Enter
Sleep 1s

Type "b"
Sleep 3s

Ctrl+C
Sleep 500ms

# ============================================================
# SCENE 5: Show what was built
# ============================================================

Type "git --no-pager diff --stat supabase/"
Enter
Sleep 3s

Enter
Sleep 300ms
Type "# Edit → Apply → Build → Deploy"
Sleep 2.5s
