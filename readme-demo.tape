# SRTD Hero Demo
# Storytelling approach: Pain → Discovery → Delight

Output readme-demo.gif

Require srtd

Set FontSize 16
Set Width 1100
Set Height 550
Set TypingSpeed 35ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set LoopOffset 30%

# ============================================================
# OPENING - gentle start
# ============================================================

Sleep 1.5s

# ============================================================
# ACT 1: THE PAIN
# ============================================================

Type "# The problem: every function change = new migration file"
Enter
Sleep 2s

Type "ls supabase/migrations/"
Enter
Sleep 2s

Enter
Sleep 500ms

# ============================================================
# ACT 2: THE DISCOVERY
# Show templates as source of truth, make a tiny change
# ============================================================

Type "# With srtd: templates are the single source of truth"
Enter
Sleep 2s

Type "ls supabase/migrations-templates/"
Enter
Sleep 2s

# Make a tiny, visible change
Type "sed -i '' 's/Hello/Howdy/' supabase/migrations-templates/srtd_demo_greet.sql"
Enter
Sleep 500ms

# Show ONLY the change with git diff (the money shot)
Type "git --no-pager diff --color supabase/migrations-templates/"
Enter
Sleep 4s

Enter
Sleep 500ms

# ============================================================
# ACT 3: THE DELIGHT
# Apply locally, build for production
# ============================================================

Type "# apply = instant reload to local database"
Enter
Sleep 1.5s

Type "srtd apply"
Enter
Sleep 2.5s

Type "# build = generate migration when ready to deploy"
Enter
Sleep 1.5s

Type "srtd build"
Enter
Sleep 2.5s

# Show new migration appeared
Type "ls supabase/migrations/"
Enter
Sleep 2.5s

# ============================================================
# SIGN OFF
# ============================================================

Enter
Sleep 500ms
Type "# Template = truth. Migration = artifact."
Sleep 2.5s
