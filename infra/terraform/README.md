# Infra runbook (apply -> screenshot -> destroy)

Stands up the real AWS stack so your CV claims are true and you have screenshots,
then tears it down so it costs ~nothing.

## Cost
ECS Fargate and the ALB are NOT free tier. A short-lived apply costs cents.
Always `terraform destroy` when done. Don't leave it running.

## Steps
cd infra/terraform
terraform init && terraform fmt -check && terraform validate
terraform apply
REPO=$(terraform output -raw ecr_repository_url)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${REPO%/*}
docker build -t $REPO:latest ../../server && docker push $REPO:latest
# wait ~2 min, then:
terraform output alb_url           # open + /healthz -> {"ok":true}
terraform output api_gateway_url
# screenshots: ECS tasks running, target group healthy, CloudWatch logs, then:
terraform destroy

## Demo vs production (say this in the interview)
- Data stores: demo runs redis + mongo as SIDECAR containers in the Fargate task
  (no ElastiCache cost). Production -> ElastiCache + MongoDB Atlas via the same
  REDIS_URL / MONGO_URL env vars (config change, not code change).
- Networking: demo uses default VPC public subnets + public IPs. Production ->
  private subnets + NAT (skipped here; NAT Gateway is ~$32/mo).

## CI/CD
- .github/workflows/ci.yml  -> PRs: ephemeral Redis+Mongo, runs concurrency test.
- .github/workflows/deploy.yml -> main: build, push to ECR, rolling ECS deploy.
  Needs repo secrets AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.
