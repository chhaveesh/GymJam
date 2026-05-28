"""evaluate.py — offline Recall@K for the implicit-ALS recommender.

Leave-one-out: for each user with >= 2 positives, hold one positive out as the
ground-truth item and train on the rest. Recall@K = fraction of users whose
held-out item appears in the model's top-K recommendations (after excluding the
items they already interacted with in training).

Why Recall@K (vs MAP / NDCG): the room actually consumes the queue order. If
the user's "next favorite" track is in the top-10 we surface, that's a win
regardless of its exact rank. Recall@K is the most honest metric for that.
"""

from __future__ import annotations

import numpy as np
import scipy.sparse as sp


def leave_one_out_split(X: sp.csr_matrix, *, seed: int = 42):
    """Hold out one nonzero per row (per user with >=2 interactions).

    Returns
    -------
    train_X : csr_matrix with the held-out cells zeroed.
    holdout : dict[user_idx -> item_idx]  (the held-out positive per user)
    """
    rng = np.random.default_rng(seed)
    X = X.tolil()
    holdout: dict[int, int] = {}
    for u in range(X.shape[0]):
        cols = list(X.rows[u])
        if len(cols) < 2:
            continue
        pick = int(rng.choice(cols))
        holdout[u] = pick
        # zero it out in train
        idx = X.rows[u].index(pick)
        X.rows[u].pop(idx)
        X.data[u].pop(idx)
    return X.tocsr(), holdout


def recall_at_k(model, train_X: sp.csr_matrix, holdout: dict, *, k: int = 10) -> float:
    """Fraction of held-out users whose ground-truth item is in top-K recs."""
    if not holdout:
        return 0.0

    hits = 0
    # implicit's recommend signature: (userid, user_items[csr row], N=..., filter_already_liked_items=True)
    # We pass the SLICED row to keep the API stable across implicit versions.
    train_csr = train_X.tocsr()
    for user_idx, true_item in holdout.items():
        try:
            recs = model.recommend(
                user_idx,
                train_csr[user_idx],
                N=k,
                filter_already_liked_items=True,
            )
        except TypeError:
            # Older implicit returns (ids, scores); newer returns a tuple too but
            # sometimes accepts different kwargs. Try the simpler call.
            recs = model.recommend(user_idx, train_csr, N=k)
        # implicit >= 0.6 returns (ids, scores) tuple of numpy arrays.
        if isinstance(recs, tuple) and len(recs) == 2:
            ids = recs[0]
        else:
            ids = [r[0] for r in recs]
        if true_item in set(int(x) for x in ids):
            hits += 1
    return hits / len(holdout)
