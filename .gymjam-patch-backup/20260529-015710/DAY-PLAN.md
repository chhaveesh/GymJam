# GymJam — Build-It-Today Plan

This is a $0, build-by-tonight path that makes your three CV bullets **true and
defensible**. The full README is the long-term vision; this is the honest MVP.

## Run the core right now (≈5 min)

```bash
cd GymJam
docker compose up --build      # api + redis + mongo
# in a second terminal:
node server/test/concurrency.js
```

You should see three ✓ checks pass. That output **is your live interview demo**.

## What each CV bullet maps to

| CV claim | Where it lives | Status today |
|---|---|---|
| Containerized microservices backend | `server/Dockerfile`, `docker-compose.yml` | ✅ built |
| Real-time vote handling: idempotent writes, race-condition handling, Redis cache | `server/src/vote.lua`, `votes.js`, `test/concurrency.js` | ✅ built + proven |
| ECS Fargate + API Gateway + ALB via Terraform | `infra/terraform/` | ⏳ next (write + validate, apply→screenshot→destroy) |
| GitHub Actions CI/CD, zero-downtime deploy | `.github/workflows/` | ⏳ next |
| CloudWatch logs/metrics + ALB health checks | Terraform + `GET /healthz` (already exists) | ⏳ partial; `/healthz` done |

## The honest money note

ECS Fargate and the ALB are **not** free tier. Two legitimate $0-ish options:
1. **apply → screenshot the running service + CloudWatch → `terraform destroy`.**
   A short-lived apply costs cents and gives you real screenshots to point at.
2. **LocalStack** — run `terraform apply` against a local AWS emulator for free.

Either way the Terraform is real, reviewable code. Don't leave paid infra running.

## Interview talking points (the stuff they'll actually ask)

- **"How do you handle 50 people voting at once?"** Votes hit a Redis Lua script.
  Redis is single-threaded and runs the script atomically, so the read-modify-write
  on the tally can't interleave — no locks, no lost updates. The concurrency test
  proves the count is exact.
- **"What if a vote request retries?"** Each user *action* carries an
  `Idempotency-Key`. A retry reuses the key and is counted once; a genuine vote
  change is a new key and is processed. (`vote.lua`, step 1.)
- **"Where's the source of truth?"** Redis is the hot path; Mongo is durable,
  written via a batched 500ms flush. Trade-off: up to 500ms of votes lost on crash
  — acceptable for tallies, keeps Mongo off the burst path. (`votes.js` flush worker.)
- **"How does it scale horizontally?"** WS gateway fans out via Redis pub/sub, so
  any task serves any client — no sticky sessions. (`index.js`.)

## What I'd build next (ask me)

1. `infra/terraform/` — ECS Fargate service, ALB + target group + health check,
   API Gateway, ECR, CloudWatch log group. Plus a teardown note.
2. `.github/workflows/deploy.yml` — lint → test → build → push to ECR → rolling deploy.
3. A tiny React voting page so the demo is clickable, not just curl.
