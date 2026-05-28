output "ecr_repository_url" {
  description = "Push your image here"
  value       = aws_ecr_repository.api.repository_url
}

output "alb_url" {
  description = "Direct ALB endpoint"
  value       = "http://${aws_lb.this.dns_name}"
}

output "api_gateway_url" {
  description = "API Gateway endpoint (fronts the ALB)"
  value       = aws_apigatewayv2_stage.default.invoke_url
}
