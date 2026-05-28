"""train.py — fit an implicit-ALS model and persist the artifact.

Why implicit ALS:
  - Upvotes are implicit positives (presence of an interaction signals taste),
    they aren't 1-5 ratings. Implicit ALS (Hu, Koren, Volinsky 2008) is the
    standard for this regime.
  - It's fast on a CPU box, deterministic given a seed, and the resulting
    user/item factor matrices give us cheap O(d) scoring at inference time.

Outputs (written under --out):
  - model.npz       : item factor matrix (n_items x k) + bias terms
  - mapping.json    : item_id <-> matrix index map (so we can score by videoId)
  - metrics.json    : best Recall@10 on the held-out split + train shape

The serving container loads these and does dot-products to score candidates.
"""

from __future__ import annotations

import argparse
import json
import os
import time

import numpy as np
import scipy.sparse as sp

from data import load, Interactions
from evaluate import recall_at_k, leave_one_out_split

try:
    from implicit.als import AlternatingLeastSquares
except ImportError as e:  # pragma: no cover
    raise SystemExit(
        "implicit not installed. `pip install -r requirements.txt` first."
    ) from e


def fit(
    interactions: Interactions,
    *,
    factors: int = 32,
    regularization: float = 0.05,
    iterations: int = 25,
    alpha: float = 20.0,
    seed: int = 42,
) -> AlternatingLeastSquares:
    """Fit implicit ALS. We scale by alpha so confidence = 1 + alpha*r per the
    Hu et al. paper — implicit's API expects pre-scaled confidence in `fit`."""
    model = AlternatingLeastSquares(
        factors=factors,
        regularization=regularization,
        iterations=iterations,
        random_state=seed,
        use_gpu=False,
    )
    # `implicit` 0.7+ expects a user-item csr matrix directly.
    model.fit((interactions.X * alpha).astype(np.float32))
    return model


def save_artifact(
    model: AlternatingLeastSquares,
    interactions: Interactions,
    out_dir: str,
    metrics: dict,
) -> None:
    os.makedirs(out_dir, exist_ok=True)
    # implicit exposes user_factors and item_factors after fit().
    np.savez(
        os.path.join(out_dir, "model.npz"),
        item_factors=np.asarray(model.item_factors, dtype=np.float32),
        user_factors=np.asarray(model.user_factors, dtype=np.float32),
    )
    with open(os.path.join(out_dir, "mapping.json"), "w") as f:
        json.dump(
            {
                "item_ids": interactions.item_ids,
                "item_index": interactions.item_index,
                "n_users": interactions.n_users,
                "n_items": interactions.n_items,
            },
            f,
        )
    with open(os.path.join(out_dir, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.environ.get("MODEL_DIR", "./artifact"))
    ap.add_argument("--source", default="auto", choices=["auto", "mongo", "synth"])
    ap.add_argument("--factors", type=int, default=32)
    ap.add_argument("--iterations", type=int, default=25)
    ap.add_argument("--regularization", type=float, default=0.05)
    ap.add_argument("--alpha", type=float, default=20.0)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--k", type=int, default=10, help="Recall@K to report")
    args = ap.parse_args()

    print(f"[train] loading data (source={args.source})...")
    interactions = load(prefer=args.source)
    print(f"[train] shape={interactions.X.shape}, nnz={interactions.X.nnz}")

    # Leave-one-out split for evaluation.
    train_X, holdout = leave_one_out_split(interactions.X, seed=args.seed)
    train_inter = Interactions(
        X=train_X,
        user_index=interactions.user_index,
        item_index=interactions.item_index,
        user_ids=interactions.user_ids,
        item_ids=interactions.item_ids,
    )

    t0 = time.time()
    model = fit(
        train_inter,
        factors=args.factors,
        regularization=args.regularization,
        iterations=args.iterations,
        alpha=args.alpha,
        seed=args.seed,
    )
    dt = time.time() - t0
    print(f"[train] fit in {dt:.2f}s")

    r_at_k = recall_at_k(model, train_X, holdout, k=args.k)
    n_items = interactions.n_items
    baseline = args.k / n_items  # random recall ≈ K/N
    print(f"[train] Recall@{args.k} = {r_at_k:.4f}  (random baseline {baseline:.4f})")

    # Refit on the full data so the served model uses everything.
    print("[train] refitting on full data for serving artifact...")
    final_model = fit(
        interactions,
        factors=args.factors,
        regularization=args.regularization,
        iterations=args.iterations,
        alpha=args.alpha,
        seed=args.seed,
    )

    save_artifact(
        final_model,
        interactions,
        args.out,
        metrics={
            "recall_at_k": r_at_k,
            "k": args.k,
            "random_baseline": baseline,
            "factors": args.factors,
            "iterations": args.iterations,
            "regularization": args.regularization,
            "alpha": args.alpha,
            "n_users": interactions.n_users,
            "n_items": interactions.n_items,
            "fit_seconds": dt,
        },
    )
    print(f"[train] artifact written to {args.out}/")


if __name__ == "__main__":
    main()
