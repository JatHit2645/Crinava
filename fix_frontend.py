import os
import re

auth_modal_path = "src/components/AuthModal.tsx"
username_modal_path = "src/components/UsernameModal.tsx"
store_paths = ["src/pages/Store.tsx", "src/pages/Home.tsx", "src/App.tsx"]

# Fix AuthModal
with open(auth_modal_path, "r", encoding="utf-8") as f:
    auth_content = f.read()

replacements = {
    "bg-cmd-bg": "bg-bg-primary",
    "border-cmd-border": "border-border-default",
    "text-cmd-text-primary": "text-fg-primary",
    "text-cmd-cyan": "text-brand-primary",
    "text-cmd-text-muted": "text-fg-muted",
    "hover:bg-cmd-surface-hover": "hover:bg-white/[0.05]",
    "bg-cmd-surface-hover": "bg-white/[0.03]",
    "text-cmd-text-secondary": "text-fg-muted",
    "bg-cmd-crimson": "bg-red-500",
    "border-cmd-crimson": "border-red-500",
    "text-cmd-crimson": "text-red-500",
    "border-cmd-border-light": "border-white/20"
}

for old, new in replacements.items():
    auth_content = auth_content.replace(old, new)

# specifically fix the button text color which was text-cmd-bg
auth_content = auth_content.replace("text-cmd-bg", "text-black")

with open(auth_modal_path, "w", encoding="utf-8") as f:
    f.write(auth_content)


# Fix UsernameModal DOB max date
with open(username_modal_path, "r", encoding="utf-8") as f:
    user_content = f.read()

if "max={new Date().toISOString().split('T')[0]}" not in user_content:
    user_content = user_content.replace(
        '<input\n                        type="date"',
        '<input\n                        type="date"\n                        max={new Date().toISOString().split(\'T\')[0]}'
    )
    user_content = user_content.replace(
        '<input type="date"',
        '<input type="date" max={new Date().toISOString().split(\'T\')[0]}'
    )

with open(username_modal_path, "w", encoding="utf-8") as f:
    f.write(user_content)


# Fix Store encoding issue
for p in store_paths:
    if os.path.exists(p):
        with open(p, "rb") as f:
            raw = f.read()
        
        # Decode as utf-8 if possible, or fallback
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            content = raw.decode("latin1")
            
        content = content.replace("â‚¹", "₹")
        
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)

print("Frontend fixes applied.")
