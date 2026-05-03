// Feature flags — set env vars in .env.local to override defaults
// NEXT_PUBLIC_SHOW_USER_COUNT=false  → hides the community user count everywhere
export const FLAGS = {
  SHOW_USER_COUNT: process.env.NEXT_PUBLIC_SHOW_USER_COUNT !== "false",
};
