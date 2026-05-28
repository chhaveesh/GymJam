# ml.tf — Step 4: SageMaker endpoint for the implicit-ALS re-ranker.
#
# Gated behind var.enable_ml because SageMaker endpoints cost ~$0.05/hr even
# when idle (ml.t2.medium). Default OFF so a `terraform apply` of the rest of
# the stack doesn't accidentally turn on hourly ML billing. Flip the var to
# true, apply, screenshot, then `terraform apply -var enable_ml=false` to
# destroy ONLY the ML resources without touching the API stack.

variable "enable_ml" {
  description = "Stand up the SageMaker recommender (costs money — flip on for demos only)."
  type        = bool
  default     = false
}

variable "ml_instance_type" {
  description = "SageMaker hosting instance. ml.t2.medium is the cheapest CPU option."
  type        = string
  default     = "ml.t2.medium"
}

# --- ECR repo for the BYOC recommender image ---------------------------------
resource "aws_ecr_repository" "recommender" {
  count                = var.enable_ml ? 1 : 0
  name                 = "${var.app_name}-recommender"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration { scan_on_push = true }
}

# --- IAM execution role for SageMaker to pull the image + write logs ---------
data "aws_iam_policy_document" "sagemaker_assume" {
  count = var.enable_ml ? 1 : 0
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["sagemaker.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "sagemaker_exec" {
  count              = var.enable_ml ? 1 : 0
  name               = "${var.app_name}-sagemaker-exec"
  assume_role_policy = data.aws_iam_policy_document.sagemaker_assume[0].json
}

# Minimum scope: pull from THIS repo, write logs, fetch model artifacts if any.
data "aws_iam_policy_document" "sagemaker_exec" {
  count = var.enable_ml ? 1 : 0

  statement {
    sid     = "ECRPull"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]
    resources = ["*"]
  }
  statement {
    sid     = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]
    resources = ["arn:aws:logs:*:*:log-group:/aws/sagemaker/*"]
  }
}

resource "aws_iam_role_policy" "sagemaker_exec" {
  count  = var.enable_ml ? 1 : 0
  name   = "${var.app_name}-sagemaker-exec"
  role   = aws_iam_role.sagemaker_exec[0].id
  policy = data.aws_iam_policy_document.sagemaker_exec[0].json
}

# --- SageMaker Model / EndpointConfig / Endpoint -----------------------------
# The image URI is sourced from a variable so you can do: build → push (via
# ml/sagemaker_deploy.py or `aws ecr ...`) → set the URI → apply. Terraform
# does NOT build the image; that's a workflow concern, not infra.
variable "ml_image_uri" {
  description = "Full ECR image URI for the recommender (set after pushing)."
  type        = string
  default     = ""
}

resource "aws_sagemaker_model" "recommender" {
  count              = var.enable_ml && var.ml_image_uri != "" ? 1 : 0
  name               = "${var.app_name}-recommender"
  execution_role_arn = aws_iam_role.sagemaker_exec[0].arn

  primary_container {
    image = var.ml_image_uri
    # Model artifacts are baked into the image, so no ModelDataUrl needed.
  }
}

resource "aws_sagemaker_endpoint_configuration" "recommender" {
  count = var.enable_ml && var.ml_image_uri != "" ? 1 : 0
  name  = "${var.app_name}-recommender-cfg"

  production_variants {
    variant_name           = "AllTraffic"
    model_name             = aws_sagemaker_model.recommender[0].name
    initial_instance_count = 1
    instance_type          = var.ml_instance_type
  }
}

resource "aws_sagemaker_endpoint" "recommender" {
  count                = var.enable_ml && var.ml_image_uri != "" ? 1 : 0
  name                 = "${var.app_name}-recommender"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.recommender[0].name
}

# --- Outputs (only when ML is on) --------------------------------------------
output "recommender_ecr_url" {
  description = "Push the BYOC recommender image here."
  value       = try(aws_ecr_repository.recommender[0].repository_url, null)
}

output "recommender_endpoint" {
  description = "SageMaker endpoint name (use SigV4 to invoke directly)."
  value       = try(aws_sagemaker_endpoint.recommender[0].name, null)
}
