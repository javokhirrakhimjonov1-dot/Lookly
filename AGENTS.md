# Deployment

This project is deployed and managed with Railway. Use the Railway CLI for
deployment-related tasks, such as checking service status, viewing deployment
logs, managing project variables, and triggering deployments.

If the `railway` command is not installed globally, invoke it with:

```powershell
pnpm dlx @railway/cli <command>
```

Before running commands against this project, ensure the local checkout is
linked to the intended Railway project and environment with `railway link`.

# Local Expo freshness

The server on port 5000 serves the generated Expo web export from
`artifacts/lookly/dist`. That directory is ignored by Git and can be older than
the checked-out frontend source.

Always start the local app with `pnpm dev` (or `start-server.bat`). Both entry
points must export the Expo web app before rebuilding and starting the API. If
frontend files change while the server is running, restart through one of these
entry points so the web export is refreshed.

Do not infer that the local and deployed UIs match only because their Git commit
hashes match. Inspect the running app on port 5000 and the deployed Railway app.
Account-specific names and data can legitimately differ between localhost and
production, so compare the shared UI, assets, and behavior.
