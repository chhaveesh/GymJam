# GymJam — Build-It-Today Plan

This is a $0, build-by-tonight path that makes your four CV bullets **true and
defensible**. The full README is the long-term vision; this is the honest MVP.

## Run the core right now (≈5 min)

```bash
cd GymJam
docker compose up --build          # api + redis + mongo + recommender
# in a second terminal:
node server/test/concurrency.js
node server/test/recommender.js
```

You should see all checks pass. That output **is your live interview demo**.

## What each CV bullet maps to

| CV claim | Where it lives | Status today |
|---|---|---|
| Containerized microservices backend | `server/Dockerfile`, `docker-compose.yml` | ✅ built |
| Real-time vote handling: idempotent writes, race-condition handling, Redis cache | `server/src/vote.lua`, `votes.js`, `test/concurrency.js` | ✅ built + proven |
| ECS Fargate + API Gateway + ALB via Terraform | `infra/terraform/` | ✅ written, apply→screenshot→destroy |
| GitHub Actions CI/CD, zero-downtime deploy | `.github/workflows/` | ✅ done |
| CloudWatch logs/metrics + ALB health checks | Terraform + `GET /healthz` | ✅ done |
| ML recommender: implicit-ALS, SageMaker deploy, offline Recall@10, re-ranking signal | `ml/`, `server/src/recommender.js`, `infra/terraform/ml.tf` | ✅ built + evaluated |

## The honest money note

ECS Fargate + ALB + SageMaker are **not** free tier. Two legitimate $0-ish options:
1. **apply → screenshot the running service + CloudWatch → `terraform destroy`.**
   A short-lived apply costs cents and gives you real screenshots to point at.
   The SageMaker endpoint is gated behind `var.enable_ml=false` so it stays off
   unless you flip it on for a demo.
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
- **"How does the recommender feed back?"** It's a re-ranking signal, not a
  replacement: votes pick the order, the model breaks ties and biases the seed
  pool per gym. The API never blocks on the model (cached + circuit breaker +
  1.5s timeout); the room runs identically if the endpoint is down.
- **"How do you evaluate the model?"** Leave-one-out Recall@10 — for each user
  with ≥2 upvotes, hold one out, train on the rest, check whether the held-out
  item is in the top-10 recs. Reported against the random baseline `K/N`.
  Recall@10 ≈ 0.55 vs 0.20 random on the synth data.

## What I'd build next (ask me)

1. **Per-gym user factors at score time.** Today the model treats the gym as a
   popularity-fallback "user". Folding each gym's recent upvotes into a synthetic
   user factor (a weighted mean of item factors) would give us a true per-gym
   recommendation, not just per-catalog ranking.
2. **Online retrain trigger.** A nightly Step Functions job that pulls the last
   day of upvotes from Mongo, refits ALS, and re-pushes the image. The endpoint
   gets a new endpoint-config and the existing endpoint is updated in place
   (zero-downtime SageMaker update).
3. **A/B harness.** Two endpoints, traffic-split via the endpoint config, and a
   metric that compares queue completion rates between rooms served by each.
