/**
 * The product name, in one place. Internal identifiers that predate the
 * rename (the `wl-` cookies, `workledger:` localStorage keys, the
 * `workledger_*` Vault secrets and the `workledger-reminders` cron job) keep
 * their old names on purpose: renaming them would silently reset users'
 * saved language and dismissed prompts, and nobody ever sees them.
 */
export const APP_NAME = "Verity";

/** File-name prefix for downloads, e.g. "verity-hours.csv". */
export const APP_SLUG = "verity";
