# C1 — Google Cloud Console + Search Console

**Runs after:** L1 is deployed and `https://gathertime.com/privacy` loads publicly.
**Unblocks:** the 10-day verification wait. This is the highest-priority Chrome session.

Read `.launch/chrome/README.md` first.

## Part 1 — Search Console (do this first; the OAuth screen needs it)

1. `search.google.com/search-console` → Add property → **Domain** (not URL prefix) →
   `gathertime.com`.
2. Google shows a TXT record. **Read it back to the user** and let them add it at the
   registrar — Claude shouldn't be driving the DNS panel where an errant edit takes the site
   down.
3. Verify. If it fails, DNS hasn't propagated; wait, don't retry in a loop.

## Part 2 — OAuth consent screen

`console.cloud.google.com` → APIs & Services → OAuth consent screen, in the project that owns
the existing `GOOGLE_CLIENT_ID`. **Confirm you're in the right project before touching
anything** — read the project selector out loud.

Set, exactly:

| Field | Value |
|---|---|
| User type | External, **Published** (not Testing) |
| App name | `Gather` |
| Logo | `public/gather_logo.png` |
| Support email | your address |
| Application home page | `https://gathertime.com` |
| Privacy policy | `https://gathertime.com/privacy` |
| Terms of service | `https://gathertime.com/terms` |
| Authorized domain | `gathertime.com` |
| Developer contact | your address |

## Part 3 — Scopes

Add exactly these and **remove anything else already listed**:

```
openid
.../auth/userinfo.email
.../auth/userinfo.profile
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

`https://www.googleapis.com/auth/calendar` and `.../calendar.readonly` were removed from
`lib/auth.ts` on purpose — full `calendar` renders on the consent screen as "See, edit, share,
and permanently delete all the calendars you can access", which is both a bad first impression
and a harder review. If either is still listed in the console, delete it.

Paste the scope justification from `.launch/LAUNCH.md` §YOU-9 into the justification field.

## Part 4 — Credentials

APIs & Services → Credentials → the OAuth 2.0 Client ID:
- Authorized JavaScript origin: `https://gathertime.com`
- Authorized redirect URI: `https://gathertime.com/api/auth/callback/google`
- Keep `http://localhost:3000/api/auth/callback/google` for local development.

Also confirm the **Google Calendar API** is enabled under Enabled APIs.

## Part 5 — Verify before submitting

Open `https://gathertime.com` in a fresh tab, click sign in with a Google account that has
**never** used this app, and screenshot the consent screen. It should list two Calendar
permissions and no mention of deleting calendars. If it says anything about deleting calendars,
the console still has the old scope — go back to Part 3.

Then **stop**. The user records the demo video (YOU-8) and hits submit themselves.

## Done when

- [ ] `gathertime.com` verified in Search Console
- [ ] Consent screen published, External, all six fields filled
- [ ] Exactly five scopes listed, none of them full `calendar`
- [ ] Redirect URI correct for production and localhost
- [ ] Screenshot of the real consent screen saved
