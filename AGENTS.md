# AI Operating Rules (Mandatory)

## Source of truth
- GitHub is the only source of truth.
- Never deploy by editing production manually.

## Repo ownership
- stratos-ai-application: only Stratos changes (grupo28/stratos clients).

## Forbidden cross-changes
- Never modify files, env vars, routes, or deploy settings from another repo/project.
- Never change production Supabase keys or Vercel production variables without explicit PR approval.

## Delivery flow
- Work on branch.
- Open PR.
- Wait for approval.
- Merge to main.
