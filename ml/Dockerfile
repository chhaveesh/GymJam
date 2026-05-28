# SageMaker BYOC container for the GymJam implicit-ALS recommender.
#
# Contract: SageMaker invokes /ping (200 = healthy) and /invocations on port 8080.
# The model artifact is baked in at /opt/ml/model so the image is self-contained
# (no S3 download at boot). Re-train by rebuilding the image — small enough to do
# in CI.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODEL_DIR=/opt/ml/model \
    PORT=8080

# implicit needs a C/C++ toolchain for the optional native pieces; the wheel
# usually covers it on slim, but we keep build-essential for safety.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ml/code
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY data.py train.py evaluate.py serve.py ./

# Train inside the image so the artifact ships with the model. CI can override
# this with a build arg pointing at a real Mongo if you want production data.
RUN mkdir -p /opt/ml/model && python train.py --source synth --out /opt/ml/model

EXPOSE 8080
# SageMaker invokes the image with `serve` as the only argument; we make
# `serve` a meaningful command via the gunicorn entrypoint.
ENTRYPOINT ["gunicorn", "-b", "0.0.0.0:8080", "-w", "2", "-t", "30", "serve:app"]
