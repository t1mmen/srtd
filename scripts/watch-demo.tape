# SRTD Watch Mode Demo
# Shows: queue edits → watch with --json streaming

Output assets/watch-demo.gif

Require srtd

Set Shell "bash"
Set FontSize 15
Set Width 1200
Set Height 500
Set TypingSpeed 50ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set LoopOffset 30%

# ============================================================
# OPENING
# ============================================================

Sleep 1s

Type "# srtd watch: live reload for SQL templates"
Enter
Enter
Sleep 1s

# ============================================================
# SCENE 1: Queue edits to template (shows template name)
# ============================================================

Type@80ms "./scripts/queue_template_edits.sh srtd_demo_greet.sql 3 2500 5000"
Enter
Sleep 1.5s

# ============================================================
# SCENE 2: Start watch with --json | jq -c
# ============================================================

Type@80ms "srtd watch --json | jq -c  # Great for CI/CD and Claude Code"
Enter

# Watch starts, edits fire at 5s, 7.5s, 10s from script start
# We started watch ~2s after script, so events come ~3s, 5.5s, 8s into watch
Sleep 11s

# Kill watch
Ctrl+C
Sleep 800ms

Enter
Type "# Save a template → instantly applied to local DB"
Sleep 2.5s
