# Login and sleeping backend startup

The login page starts a foreground, credential-free health check as soon as it opens. Concurrent readiness subscribers share one request. Checks stop on success, cancellation, page destruction, or a 180-second deadline. Each probe has an 8-second timeout with a 2-second delay between attempts. There is no background keepalive.

Submitting the form waits for readiness before sending credentials once. The existing 45-second authentication timeout starts only after readiness. Invalid credentials are never automatically retried. Users can cancel without losing their form values. Readiness is cached for only 15 seconds.

The Docker JVM uses `-XX:TieredStopAtLevel=1` to reduce compilation work during startup on the small free instance. This trades peak steady-state throughput for startup cost; remove the flag to restore full tiered compilation. Measure startup and warm request performance after deployment before claiming a specific reduction. Migrations and schema guards remain enabled.

The free Render instance can still sleep and must be started by a request. These changes overlap startup with form entry and prevent credentials being sent into a sleeping service; they cannot eliminate the platform wake delay. An always-on hosting plan is a separate, billable choice and is not changed here.
