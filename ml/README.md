# GymJam recommender (Step 4)

Implicit-feedback collaborative filtering (alternating least squares) trained on
upvotes, deployed as a SageMaker BYOC container, and consumed by the API as a
**re-ranking signal** — votes still pick the order; the model breaks ties and
biases the seed pool toward what each gym is likely to enjoy.

## What's in here

| File | Purpose |
|---|---|
| `data.py` | Builds the interactions matrix. Loads real upvotes from Mongo if present, otherwise synthesizes a 200×50 cluster-structured matrix for repeatable training. |
| `train.py` | Fits implicit ALS, evaluates Recall@10 on a leave-one-out split, then refits on the full data and writes the artifact to `--out`. |
| `evaluate.py` | Recall@K + the leave-one-out splitter. Imported by `train.py`. |
| `serve.py` | Flask app speaking SageMaker's `/ping` + `/invocations` contract. Runs locally too — point `RECOMMENDER_URL` at it. |
| `Dockerfile` | BYOC image. Trains during the build so the artifact ships with the container. |
| `sagemaker_deploy.py` | One-shot `up` / `down` for the ECR repo, model, endpoint-config, endpoint. |

The Terraform path is in [`../infra/terraform/ml.tf`](../infra/terraform/ml.tf)
and is the preferred deployment route for the same reasons the rest of the infra
is in code.

## Quickstart (local, ~1 min)

```bash
cd ml
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Train (synth data; takes a few seconds) and emit metrics.
python train.py --out ./artifact

# Serve it.
MODEL_DIR=./artifact python serve.py
# → http://localhost:8080  (try: curl localhost:8080/ping)

# Then in the GymJam server, set:
#   RECOMMENDER_URL=http://localhost:8080
# (or, in docker-compose, http://recommender:8080 — see the compose file)
```

Train output looks like:

```
[train] shape=(200, 50), nnz=2034
[train] fit in 0.31s
[train] Recall@10 = 0.5450  (random baseline 0.2000)
[train] artifact written to ./artifact/
```

Recall@10 ≈ 0.55 on the synthetic data is well above the 0.20 random baseline,
which is the point of the eval: it lets you tell a regression from noise.

## How the signal feeds back into the room

1. **Autofill (`server/src/votes.js::autofill`)** asks the recommender to score
   the unused portion of the seed pool for each gym. We pick the top-need
   tracks instead of random — different rooms diverge from day one.
2. **State response (`getState`)** sorts the queue by `(tally, recScore)`.
   Votes are primary: a track with +1 tally always beats a 0, regardless of
   rec score. The rec score only matters when two tracks tied on votes.
3. **Cache (`startRecommenderRefresher`)** warms a per-gym score cache every
   30s so `/api/.../state` never blocks on a model call.

All three paths fail closed: if the recommender is unreachable, the room runs
exactly like it did in Step 3 (random shuffle, vote-only ordering).

## Evaluation (Recall@10)

Why this metric: the queue is consumed in order. If the song the user would
actually pick next lives anywhere in the top-10 we surface, that's a hit. MAP /
NDCG penalize sub-rank-1 misses more — useful when the rank really matters, less
honest here, where any top-10 placement gets the song heard.

Methodology (in `evaluate.py`):
- For each user with ≥2 upvotes, hold one out uniformly at random.
- Train on the rest. Ask the model for top-K, filtering already-liked items.
- Recall@K = (# users whose held-out item is in top-K) / total users with a held-out.

## Deploying

### Terraform (preferred)

```bash
cd infra/terraform
# Set required vars (region, role policies, etc.) — see ml-variables documented in main.tf.
terraform init && terraform apply
```

Outputs include the endpoint name. Set the API's env to call it:

```
RECOMMENDER_URL=https://runtime.sagemaker.<region>.amazonaws.com/endpoints/<name>/invocations
```

(In practice you'd front the endpoint with API Gateway or a small Lambda that
signs requests — direct invocation needs SigV4. For the demo the local
docker-compose path is simpler.)

### Script

```bash
cd ml
export SAGEMAKER_ROLE_ARN=arn:aws:iam::<acct>:role/<role>
python sagemaker_deploy.py up    # builds, pushes, deploys
python sagemaker_deploy.py down  # tears it all down — do this when you finish demoing
```

## Honest scope

- The "user" in this model is a **member**, not a gym. To score a gym we use a
  popularity fallback (norm of each item-factor row), and we cache per-gym in
  Redis. A richer build would fold each gym's recent upvotes into a synthetic
  user factor at score time — straightforward extension.
- The synthetic data has cluster structure on purpose, so Recall@10 reads as
  an upper bound. On real `votes` from Mongo the number will be lower.
- We don't retrain online. The pipeline is offline batch — fine for tracks
  whose popularity moves on the order of days.
