# Oracle Cloud Always Free VM for TripMate + Coolify

This file covers only the VM/bootstrap step. The TripMate application deployment itself is documented in `COOLIFY_DEPLOYMENT.md`.

## Recommended VM

Create an Oracle Cloud **Always Free Eligible** Ampere A1 instance in your home region.

Recommended allocation for TripMate + Coolify:

- Shape: `VM.Standard.A1.Flex`
- OCPU: `2`
- Memory: `12 GB`
- Image: Ubuntu 24.04 LTS ARM64
- Boot volume: 50 GB
- Public IPv4: enabled

This stays within the Oracle Always Free allocation described in Oracle's current documentation, subject to capacity availability in the selected region.

## Network ingress

Allow these inbound TCP ports in the OCI VCN security list / network security group:

- `22` — SSH
- `80` — HTTP / certificate challenge
- `443` — HTTPS
- `8000` — initial Coolify dashboard
- `6001` — Coolify real-time updates when using direct IP access
- `6002` — Coolify web terminal when using direct IP access

Do not expose MySQL 3306 or the Spring Boot backend directly.

## Automatic Coolify installation

When creating the OCI instance, paste the contents of:

`infra/oracle-coolify/cloud-init.yaml`

into the instance **Cloud-init / user data** field.

The VM will install Coolify automatically on first boot using Coolify's official installer.

After the VM finishes provisioning, open:

`http://<PUBLIC_IP>:8000`

Create the Coolify administrator account immediately.

If you need to inspect the installer log over SSH:

```bash
sudo tail -n 200 /var/log/coolify-install.log
```

## Next step

In Coolify:

1. Add/connect the private GitHub repository `Thiru-Murugan3/TripMate`.
2. Select branch `development`.
3. Choose Docker Compose.
4. Compose file: `/docker-compose.coolify.yml`.
5. Add the Brevo variables documented in `COOLIFY_DEPLOYMENT.md`.
6. Assign a public domain to the `web` service on port 8080.
7. Deploy and run the production smoke tests.

## Cost warning

Always verify that the instance is marked **Always Free Eligible** before creating it. Resources outside the Always Free allowance can incur charges. Oracle also states that idle Always Free compute instances can be reclaimed and that A1 capacity may be temporarily unavailable.
