"""data.py — load or synthesize implicit-feedback interactions for training.

The recommender treats *upvotes* as positive implicit signals (a member "engaged
with" a video). Downvotes are intentionally NOT used as negative weights: that
would teach the model to suppress popular-but-polarizing songs, which is the
opposite of what the room wants. We rely on implicit ALS's negative sampling
of unseen items to give us proper negatives.

Two data sources, picked in order:
  1. MongoDB collection `votes` (production: real interactions captured by the
     server). Connect with MONGO_URL.
  2. Deterministic synthetic data — 200 users, 50 items, taste-cluster generated
     so that ALS has structure to learn. Used for local dev, CI, and the demo.

Output shape:
  X : scipy.sparse.csr_matrix, shape = (n_users, n_items), dtype=float32
  user_index : dict[str -> int]
  item_index : dict[str -> int]
"""

from __future__ import annotations

import os
import math
import random
from dataclasses import dataclass

import numpy as np
import scipy.sparse as sp


@dataclass
class Interactions:
    X: sp.csr_matrix
    user_index: dict
    item_index: dict
    user_ids: list
    item_ids: list

    @property
    def n_users(self) -> int:
        return self.X.shape[0]

    @property
    def n_items(self) -> int:
        return self.X.shape[1]


# Default seed pool — must match server/src/youtube.js DEFAULT_SEED_IDS.
DEFAULT_VIDEO_IDS = [
    "dQw4w9WgXcQ", "OPf0YbXqDm0", "kJQP7kiw5Fk", "9bZkp7q19f0", "JGwWNGJdvx8",
    "RgKAFK5djSk", "CevxZvSJLk8", "hT_nvWreIhg", "09R8_2nJtjg", "60ItHLz5WEA",
    "7wtfhZwyrcc", "YQHsXMglC9A", "pRpeEdMmmQ0", "fLexgOxsZu0", "2Vv-BfVoq4g",
]


def synthesize(n_users: int = 200, n_items: int = 50, seed: int = 42) -> Interactions:
    """Generate a reproducible implicit-feedback matrix with cluster structure.

    Members are split into 5 taste clusters, each with a soft preference over
    one of 5 item clusters. This gives ALS a real (low-rank) signal to learn,
    so Recall@10 lands well above the random baseline (~10/n_items).
    """
    rng = np.random.default_rng(seed)
    n_user_clusters = 5
    n_item_clusters = 5
    items_per_cluster = n_items // n_item_clusters

    # Affinity matrix: cluster i has 0.85 prob of liking its own cluster's items.
    affinity = np.full((n_user_clusters, n_item_clusters), 0.05)
    np.fill_diagonal(affinity, 0.85)
    # A little cross-cluster leakage so the problem isn't trivial.
    for i in range(n_user_clusters):
        affinity[i, (i + 1) % n_item_clusters] = 0.20

    user_cluster = rng.integers(0, n_user_clusters, size=n_users)

    rows, cols, data = [], [], []
    for u in range(n_users):
        c = user_cluster[u]
        # Each user upvotes between 5 and 15 items.
        n_pos = int(rng.integers(5, 16))
        seen = set()
        attempts = 0
        while len(seen) < n_pos and attempts < n_pos * 5:
            attempts += 1
            ic = rng.choice(n_item_clusters, p=affinity[c] / affinity[c].sum())
            i = ic * items_per_cluster + int(rng.integers(0, items_per_cluster))
            if i in seen:
                continue
            seen.add(i)
            rows.append(u)
            cols.append(i)
            # Implicit "strength" — repeat upvotes by the same person on the
            # same track aren't possible here (we model unique upvotes), so we
            # use a light confidence weight ~ rand(1.0, 2.0) per Hu et al. 2008.
            data.append(float(1.0 + rng.random()))

    X = sp.csr_matrix(
        (data, (rows, cols)),
        shape=(n_users, n_items),
        dtype=np.float32,
    )

    user_ids = [f"u{i:04d}" for i in range(n_users)]
    item_ids = [
        DEFAULT_VIDEO_IDS[i] if i < len(DEFAULT_VIDEO_IDS) else f"v_synth_{i:04d}"
        for i in range(n_items)
    ]
    return Interactions(
        X=X,
        user_index={uid: i for i, uid in enumerate(user_ids)},
        item_index={iid: i for i, iid in enumerate(item_ids)},
        user_ids=user_ids,
        item_ids=item_ids,
    )


def load_from_mongo(uri: str | None = None) -> Interactions | None:
    """Best-effort load of real votes from Mongo. Returns None if no data."""
    try:
        from pymongo import MongoClient
    except ImportError:
        return None
    uri = uri or os.environ.get("MONGO_URL")
    if not uri:
        return None
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=1500)
        db = client.get_default_database() or client["gymjam"]
        cur = db["votes"].find(
            {"direction": "up"},
            {"memberId": 1, "trackId": 1, "_id": 0},
        )
        rows = list(cur)
    except Exception:
        return None

    if len(rows) < 50:  # too few to learn anything useful
        return None

    user_ids = sorted({r["memberId"] for r in rows if r.get("memberId")})
    item_ids = sorted({r["trackId"] for r in rows if r.get("trackId")})
    if not user_ids or not item_ids:
        return None

    user_index = {u: i for i, u in enumerate(user_ids)}
    item_index = {t: i for i, t in enumerate(item_ids)}

    r = [user_index[x["memberId"]] for x in rows]
    c = [item_index[x["trackId"]] for x in rows]
    d = [1.0] * len(rows)
    X = sp.csr_matrix(
        (d, (r, c)),
        shape=(len(user_ids), len(item_ids)),
        dtype=np.float32,
    )
    return Interactions(
        X=X,
        user_index=user_index,
        item_index=item_index,
        user_ids=user_ids,
        item_ids=item_ids,
    )


def load(prefer: str = "auto") -> Interactions:
    """Top-level loader. `prefer` is 'mongo' | 'synth' | 'auto'."""
    if prefer in ("mongo", "auto"):
        out = load_from_mongo()
        if out is not None:
            return out
        if prefer == "mongo":
            raise RuntimeError("requested mongo source, but no usable data found")
    return synthesize()
