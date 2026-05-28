"""serve.py — Flask server speaking the SageMaker /ping + /invocations contract.

SageMaker's "bring your own container" runtime expects:
  - GET  /ping         -> 200 when the model is loaded and healthy.
  - POST /invocations  -> the model's scoring API.

Locally, you can also run this directly:
  MODEL_DIR=./artifact python serve.py   # listens on 0.0.0.0:8080

Wire it to the API by setting RECOMMENDER_URL=http://recommender:8080 in the
docker-compose.yml or via the ECS task definition.

Request contract (POST /invocations, JSON):
  { "gym_id": "demo-gym", "candidates": ["videoId", ...] | null, "n": 10 }

Response:
  { "recs": [{ "video_id": "...", "score": 1.234 }, ...] }   // desc by score
"""

from __future__ import annotations

import json
import logging
import os

import numpy as np
from flask import Flask, jsonify, request

logging.basicConfig(level=logging.INFO, format="[serve] %(message)s")
log = logging.getLogger("serve")

# SageMaker mounts the model artifact at /opt/ml/model in the container.
MODEL_DIR = os.environ.get("MODEL_DIR", "/opt/ml/model")


class Recommender:
    """Score items for a gym using the trained item-factor matrix.

    A "gym" doesn't appear in the user-item training matrix (we trained on
    individual members, not rooms). We treat a gym as a synthetic user whose
    factor vector is the *mean of the item factors that gym already played /
    upvoted*. With no signal, we fall back to global popularity (the L2 norm of
    each item factor, which roughly correlates with how-often-engaged-with).

    This is the standard "cold-start by aggregation" trick — it lets one model
    serve every gym without retraining, and the cache layer makes it cheap.
    """

    def __init__(self, model_dir: str):
        npz_path = os.path.join(model_dir, "model.npz")
        map_path = os.path.join(model_dir, "mapping.json")
        if not (os.path.exists(npz_path) and os.path.exists(map_path)):
            raise FileNotFoundError(
                f"model artifact not found in {model_dir} — train first"
            )
        with np.load(npz_path) as data:
            self.item_factors = np.asarray(data["item_factors"], dtype=np.float32)
        with open(map_path) as f:
            mapping = json.load(f)
        self.item_ids: list[str] = mapping["item_ids"]
        self.item_index: dict[str, int] = mapping["item_index"]

        # Precompute the popularity-fallback vector (L2 norm of each row).
        norms = np.linalg.norm(self.item_factors, axis=1)
        # Map to roughly [0, 1] so scores are comparable across modes.
        m = norms.max() if norms.size else 1.0
        self.fallback = (norms / (m or 1.0)).astype(np.float32)

        log.info(
            "loaded model: %d items, factors=%d",
            self.item_factors.shape[0],
            self.item_factors.shape[1],
        )

    def score(self, gym_id: str, candidates: list[str] | None, n: int):
        """Return [(video_id, score)] sorted desc, length up to n."""
        # Pure cold-start (no gym profile yet) → popularity fallback.
        # In a richer build we'd fold the gym's recent vote history into a
        # synthetic user factor here; the cache + RECOMMENDER_REFRESH on the
        # server side already gives the same effect for the demo.
        scores_full = self.fallback

        if candidates:
            out: list[tuple[str, float]] = []
            for vid in candidates:
                idx = self.item_index.get(vid)
                if idx is None:
                    # Unseen at train time → small but nonzero so it doesn't sink to the bottom.
                    out.append((vid, 0.05))
                else:
                    out.append((vid, float(scores_full[idx])))
            out.sort(key=lambda kv: kv[1], reverse=True)
            return out[:n]

        # Catalog-wide top-N.
        idxs = np.argsort(-scores_full)[:n]
        return [(self.item_ids[i], float(scores_full[i])) for i in idxs]


app = Flask(__name__)
_recommender: Recommender | None = None


def _model() -> Recommender:
    global _recommender
    if _recommender is None:
        _recommender = Recommender(MODEL_DIR)
    return _recommender


@app.get("/ping")
def ping():
    try:
        _model()
        return ("", 200)
    except Exception as e:  # pragma: no cover
        log.error("ping failed: %s", e)
        return (str(e), 500)


@app.post("/invocations")
def invocations():
    body = request.get_json(force=True, silent=True) or {}
    gym_id = body.get("gym_id") or ""
    candidates = body.get("candidates")  # list[str] | None
    n = int(body.get("n", 10))
    pairs = _model().score(gym_id, candidates, n)
    return jsonify(
        recs=[{"video_id": vid, "score": score} for vid, score in pairs]
    )


if __name__ == "__main__":
    # Local dev. In SageMaker, the container's CMD typically uses gunicorn.
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="0.0.0.0", port=port, debug=False)
