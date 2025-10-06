gh auth login
# Google AI generated from "autoconfig git user.name/email with gh cli"
gh api user | jq -r '"git config --global user.name \"\(.name)\" && git config --global user.email \"\(.email)\""' | sh
