# API Gateway (HTTP API) in front of the ALB via a VPC Link — this is what makes
# the "API Gateway + ALB" CV claim literally true. Public traffic can hit either
# the ALB DNS directly or the API Gateway invoke URL.
resource "aws_apigatewayv2_api" "http" {
  name          = "${var.app_name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_vpc_link" "this" {
  name               = "${var.app_name}-vpclink"
  subnet_ids         = data.aws_subnets.default.ids
  security_group_ids = [aws_security_group.alb.id]
}

resource "aws_apigatewayv2_integration" "alb" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.this.id
  integration_uri    = aws_lb_listener.http.arn
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}
