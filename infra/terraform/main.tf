terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# Use the account's default VPC + subnets to keep this demo cheap and quick to
# stand up. Production (per the README) would use a dedicated VPC with private
# subnets + NAT; that adds a ~$32/mo NAT Gateway, so it's intentionally skipped
# for a portfolio bring-up. This is an honest, defensible simplification.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
