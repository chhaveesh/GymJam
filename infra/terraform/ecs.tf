resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.app_name}"
  retention_in_days = 7
}

resource "aws_security_group" "service" {
  name        = "${var.app_name}-svc"
  description = "Fargate tasks - traffic only from the ALB"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "from ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_cluster" "this" {
  name = var.app_name
}

# DEMO SHAPE: redis + mongo run as sidecar containers in the same task, so the
# whole app stands up on Fargate with no external data stores (no ElastiCache
# cost, no Atlas wiring). Containers in one awsvpc task share localhost.
# PRODUCTION: drop the sidecars, point REDIS_URL at ElastiCache and MONGO_URL at
# MongoDB Atlas. Documented in infra/terraform/README.md.
resource "aws_ecs_task_definition" "api" {
  family                   = var.app_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "redis"
      image     = "redis:7-alpine"
      essential = true
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "redis"
        }
      }
    },
    {
      name      = "mongo"
      image     = "mongo:7"
      essential = true
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "mongo"
        }
      }
    },
    {
      name         = "api"
      image        = "${aws_ecr_repository.api.repository_url}:latest"
      essential    = true
      portMappings = [{ containerPort = var.container_port, protocol = "tcp" }]
      environment = [
        { name = "REDIS_URL", value = "redis://localhost:6379" },
        { name = "MONGO_URL", value = "mongodb://localhost:27017" },
        { name = "PORT", value = tostring(var.container_port) }
      ]
      dependsOn = [
        { containerName = "redis", condition = "START" },
        { containerName = "mongo", condition = "START" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name            = var.app_name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Zero-downtime rolling deploy: stand up the new task and let it pass health
  # checks before the old one is drained.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = true # default (public) subnets, no NAT -> need a public IP to pull images
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.http]

  # CI registers new task-def revisions out-of-band; don't let Terraform revert them.
  lifecycle {
    ignore_changes = [task_definition]
  }
}
