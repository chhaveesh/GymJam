"""sagemaker_deploy.py — build, push to ECR, and deploy to SageMaker.

Two ways to deploy this recommender:

1. **Terraform** (preferred for review-ability) — see infra/terraform/ml.tf.
   That path is fully reproducible and pairs with the existing infra story.

2. **This script** — useful for one-off bring-ups when you don't want to wait
   on a full terraform plan/apply cycle, or for tearing things down quickly.

Both paths end up with the same shape: an ECR image hosting the BYOC container,
a SageMaker Model wrapping it, an EndpointConfig (instance_type, count), and an
Endpoint that the API calls via RECOMMENDER_URL.

Usage:
  python sagemaker_deploy.py up    # build + push + create endpoint
  python sagemaker_deploy.py down  # delete endpoint + endpoint-config + model
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import shlex
import subprocess
import sys
import time

REGION = os.environ.get("AWS_REGION", "us-east-1")
REPO = os.environ.get("ECR_REPO", "gymjam-recommender")
IMAGE_TAG = os.environ.get("IMAGE_TAG", "latest")
MODEL_NAME = os.environ.get("MODEL_NAME", "gymjam-recommender")
ENDPOINT_CONFIG = os.environ.get("ENDPOINT_CONFIG", "gymjam-recommender-cfg")
ENDPOINT_NAME = os.environ.get("ENDPOINT_NAME", "gymjam-recommender")
INSTANCE_TYPE = os.environ.get("INSTANCE_TYPE", "ml.t2.medium")
ROLE_ARN_ENV = "SAGEMAKER_ROLE_ARN"


def sh(cmd: str, *, check: bool = True, capture: bool = False) -> str:
    print(f"$ {cmd}")
    res = subprocess.run(
        shlex.split(cmd),
        check=check,
        text=True,
        capture_output=capture,
    )
    return res.stdout if capture else ""


def aws_json(cmd: str) -> dict:
    out = sh(f"aws {cmd} --output json", capture=True)
    return json.loads(out) if out.strip() else {}


def ensure_repo() -> str:
    try:
        info = aws_json(f"ecr describe-repositories --repository-names {REPO} --region {REGION}")
    except subprocess.CalledProcessError:
        info = aws_json(f"ecr create-repository --repository-name {REPO} --region {REGION}")
    uri = info["repositories"][0]["repositoryUri"]
    return uri


def build_and_push(repo_uri: str) -> str:
    sh(f"docker build -t {REPO}:{IMAGE_TAG} -f Dockerfile .")
    sh(
        f"aws ecr get-login-password --region {REGION} | "
        f"docker login --username AWS --password-stdin {repo_uri}"
    )
    full = f"{repo_uri}:{IMAGE_TAG}"
    sh(f"docker tag {REPO}:{IMAGE_TAG} {full}")
    sh(f"docker push {full}")
    return full


def role_arn() -> str:
    arn = os.environ.get(ROLE_ARN_ENV)
    if not arn:
        sys.exit(
            f"set {ROLE_ARN_ENV} to a SageMaker execution role ARN "
            "(see infra/terraform/ml.tf for the IAM doc)"
        )
    return arn


def up():
    repo_uri = ensure_repo()
    image_uri = build_and_push(repo_uri)
    arn = role_arn()
    sh(
        "aws sagemaker create-model "
        f"--region {REGION} --model-name {MODEL_NAME} "
        f"--primary-container Image={image_uri} "
        f"--execution-role-arn {arn}"
    )
    sh(
        "aws sagemaker create-endpoint-config "
        f"--region {REGION} --endpoint-config-name {ENDPOINT_CONFIG} "
        f"--production-variants VariantName=AllTraffic,ModelName={MODEL_NAME},"
        f"InstanceType={INSTANCE_TYPE},InitialInstanceCount=1"
    )
    sh(
        "aws sagemaker create-endpoint "
        f"--region {REGION} --endpoint-name {ENDPOINT_NAME} "
        f"--endpoint-config-name {ENDPOINT_CONFIG}"
    )
    print(f"\n[ok] endpoint creating: {ENDPOINT_NAME}")
    print(
        "Poll with:\n"
        f"  aws sagemaker describe-endpoint --endpoint-name {ENDPOINT_NAME} --region {REGION}"
    )


def down():
    for cmd, name_flag in [
        ("delete-endpoint",        f"--endpoint-name {ENDPOINT_NAME}"),
        ("delete-endpoint-config", f"--endpoint-config-name {ENDPOINT_CONFIG}"),
        ("delete-model",           f"--model-name {MODEL_NAME}"),
    ]:
        try:
            sh(f"aws sagemaker {cmd} --region {REGION} {name_flag}")
        except subprocess.CalledProcessError:
            print(f"[warn] {cmd} failed (already gone?)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["up", "down"])
    args = ap.parse_args()
    {"up": up, "down": down}[args.action]()


if __name__ == "__main__":
    main()
