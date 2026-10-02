# Fix: Principle of Least Privilege in ilm-init.sh

## The Original Problem

The initialization script (`ilm-init.sh`) executed all its HTTP requests to the Elasticsearch API using the built-in `elastic` user. The `elastic` user is a superuser with unrestricted access to the entire cluster. 

While acceptable for a bootstrap job, using superuser credentials for routine operational setup (like creating policies and templates) violates the principle of least privilege, a core concept in cybersecurity hardening. 

## The Applied Change

The `ilm-init.sh` script was rewritten to strictly compartmentalize privileges:

1. **Role Creation:** The script uses the `elastic` superuser *exactly once* at the beginning to create a highly restricted role (`ilm_admin_role`). This role is only granted the specific cluster privileges needed: `manage_ilm`, `manage_slm`, `manage_index_templates`, and `manage_repository`.
2. **Temporary User:** A temporary user (`ilm_admin`) is created and assigned this restricted role, utilizing a randomly generated 16-character password (`$ILM_PASS`).
3. **Execution:** All subsequent API calls (registering the repository, creating the SLM and ILM policies, updating the templates) are executed using the restricted `ilm_admin` user.
4. **Cleanup:** At the very end of the script, the temporary `ilm_admin` user is deleted, ensuring no unnecessary accounts remain active.

## What this Affects

1. **Cybersecurity Hardening:** This perfectly aligns with the security-first mindset of the project. By scoping down privileges programmatically, the blast radius of any potential script manipulation or credential leakage during execution is drastically reduced.
2. **Best Practices:** It demonstrates advanced knowledge of Elasticsearch's Role-Based Access Control (RBAC) API, rather than relying on the default superuser for everything.
