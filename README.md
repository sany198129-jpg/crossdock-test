# Кросс-док — тестовый стенд

The test site is protected by HTTP Basic Authentication. It accepts the username `tester` and the password configured in the server-only `TEST_SITE_PASSWORD` environment variable. The application fails closed with HTTP 503 when the variable is missing.

Set a long, unique password in the hosting provider's secret/environment-variable settings. Do not commit the password or expose it through a `NEXT_PUBLIC_*` variable. Use HTTPS for any shared or hosted deployment because HTTP Basic Authentication does not encrypt credentials on its own.

For local PowerShell testing:

```powershell
$env:TEST_SITE_PASSWORD = "replace-with-a-long-unique-password"
npm.cmd run build
npm.cmd start
```

The root path and all other application paths redirect to `/castdocs` after authentication. Static assets are also protected by the middleware.
