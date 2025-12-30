# SRTD Hero Demo - The "Aha Moment" in ~25 seconds
# Storytelling approach: Pain → Discovery → Delight
# Uses git diff to show ONLY what changed (not full files)

Output readme-demo.gif

Require srtd

# Larger font, smaller terminal = less overwhelming
Set FontSize 18
Set Width 900
Set Height 480
Set TypingSpeed 35ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set LoopOffset 30%

# ============================================================
# ACT 1: THE PAIN (3s)
# ============================================================

Type "# The problem: changing a function = new migration file"
Enter
Sleep 2s

Type "ls supabase/migrations/"
Enter
Sleep 1.5s

Enter
Sleep 300ms

# ============================================================
# ACT 2: THE DISCOVERY (10s)
# Show templates as source of truth, make a tiny change
# ============================================================

Type "# With srtd: templates are the source of truth"
Enter
Sleep 1.5s

Type "ls supabase/migrations-templates/"
Enter
Sleep 1.5s

# Make a tiny, visible change
Type "sed -i '' 's/Hello/Howdy/' supabase/migrations-templates/srtd_demo_greet.sql"
Enter
Sleep 500ms

# Show ONLY the change with git diff (the money shot)
Type "git diff --color supabase/migrations-templates/"
Enter
Sleep 3.5s

Enter
Sleep 300ms

# ============================================================
# ACT 3: THE DELIGHT (10s)
# Apply locally, build for production
# ============================================================

Type "srtd apply"
Enter
Sleep 2s

Type "srtd build"
Enter
Sleep 2.5s

# Show new migration appeared
Type "ls supabase/migrations/"
Enter
Sleep 2s

# ============================================================
# SIGN OFF (2s)
# ============================================================

Enter
Sleep 300ms
Type "# Template = truth. Migration = artifact."
Sleep 2s
