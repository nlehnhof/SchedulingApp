# Chrome sessions

These are run with **Claude in Chrome**, in a browser where you're already signed in to the
dashboard in question, with you watching.

## Ground rules for every session

- **Invoke the `claude-in-chrome` skill first**, then `tabs_context_mcp` before anything else.
  Work in a new tab; don't hijack one of yours.
- **Grant the extension site permission** for the specific dashboard before starting. Claude
  can't act on a site it hasn't been allowed.
- **Claude never types a secret.** API keys, signing secrets, service-role keys, passwords, card
  numbers, bank details: you type those. Anything on a page Claude reads enters model context,
  and a signing secret that leaks into a transcript has to be rotated. When a step needs a
  secret, Claude's job is to navigate to the field and stop.
- **You handle every 2FA prompt and every payment form.** Don't work around it.
- **Avoid destructive buttons.** These dashboards are full of Delete actions behind native
  `confirm()` dialogs, and a native dialog freezes the extension until you dismiss it by hand.
  If a step needs one, Claude should say so and let you click.
- **Screenshot the final state of every config screen** and save it. When Google's reviewer
  asks why a field says what it says three weeks from now, you'll want the picture.
- **Stop and ask after two failed attempts** at the same action. These consoles change layout
  often; guessing wastes more time than asking.
