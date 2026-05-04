# AWS Deployment Guide

Target architecture (recommended):

```
   Route 53            S3 (private)            CloudFront (cache/CDN)
       |                    |                          |
       v                    v                          v
   ALB (https) -----> ECS Fargate cluster:  freecycle-cluster
                         |  api-gateway      (public target group)
                         |  user-service
                         |  listing-service  (S3 IAM role attached)
                         |  location-service
                         |  chat-service     (sticky sessions / Redis adapter)
                         |  notification-service
                         |  frontend (nginx)
                         v
                    RDS (PostgreSQL + PostGIS)
                    ElastiCache (Redis)
```

## 1. Prerequisites

- AWS account + IAM user with admin (or scoped) credentials
- A domain name and ACM certificate for HTTPS
- AWS CLI v2 installed and `aws configure` done
- Docker registry: ECR (recommended) or Docker Hub

## 2. Provision infrastructure

You can use raw AWS CLI / the console, or Terraform/CDK. The minimum
resources are:

| Resource           | Notes                                                         |
|--------------------|---------------------------------------------------------------|
| VPC + 2 subnets    | Public subnets for ALB, private for ECS tasks & RDS           |
| Security groups    | ALB:443; ECS->RDS:5432; ECS->Redis:6379                       |
| RDS                | PostgreSQL 15, run `CREATE EXTENSION postgis;` once           |
| ElastiCache Redis  | cluster-mode-disabled is fine for pub/sub                     |
| S3 bucket          | name = `S3_BUCKET` env, public-read for objects via policy    |
| IAM role for tasks | Allow `s3:PutObject`, `s3:DeleteObject` on the bucket         |
| ECR repos          | one per service (`api-gateway`, `user-service`, ... or one)   |
| ALB                | listeners 443 -> target groups for `api-gateway` & `frontend` |
| Route53            | `app.example.com -> ALB`, `api.example.com -> ALB`            |

## 3. Run schema on RDS

```bash
psql "postgresql://user:pw@<rds-host>:5432/freecycle" \
  -f database/init/001_schema.sql
```

For ongoing migrations, add `node-pg-migrate` and a `migrations/` folder; run the migration step in the Jenkinsfile before the deploy stage.

## 4. Set up environment per ECS task

Use AWS Secrets Manager or SSM Parameter Store. **Never** hardcode secrets in the task definition. Each task definition references the secrets:

```json
{
  "secrets": [
    { "name": "POSTGRES_PASSWORD", "valueFrom": "arn:aws:secretsmanager:..." },
    { "name": "JWT_SECRET",        "valueFrom": "arn:aws:secretsmanager:..." }
  ],
  "environment": [
    { "name": "POSTGRES_HOST", "value": "freecycle.cluster-xyz.us-east-1.rds.amazonaws.com" },
    { "name": "POSTGRES_DB",   "value": "freecycle" },
    { "name": "POSTGRES_USER", "value": "freecycle" },
    { "name": "REDIS_HOST",    "value": "freecycle.cache.amazonaws.com" },
    { "name": "S3_BUCKET",     "value": "freecycle-listings-images" },
    { "name": "AWS_REGION",    "value": "us-east-1" },
    { "name": "USER_SERVICE_URL",         "value": "http://user-service.freecycle.local:4001" },
    { "name": "LISTING_SERVICE_URL",      "value": "http://listing-service.freecycle.local:4002" },
    { "name": "LOCATION_SERVICE_URL",     "value": "http://location-service.freecycle.local:4003" },
    { "name": "CHAT_SERVICE_URL",         "value": "http://chat-service.freecycle.local:4004" },
    { "name": "NOTIFICATION_SERVICE_URL", "value": "http://notification-service.freecycle.local:4005" }
  ]
}
```

The `*.freecycle.local` URLs come from ECS Service Discovery (Cloud Map). Enable it on the cluster so each ECS service registers a DNS name.

## 5. Push images via Jenkins

Configure the following Jenkins credentials (Manage Jenkins -> Credentials):

| Credential ID     | Type                | Used for                  |
|-------------------|---------------------|---------------------------|
| `dockerhub-creds` | username / password | Registry login            |
| `aws-creds`       | AWS                 | `aws ecs update-service`  |

Pipeline parameters / env on Jenkins:

```
DOCKER_REGISTRY = 12345.dkr.ecr.us-east-1.amazonaws.com/freecycle
AWS_REGION      = us-east-1
ECS_CLUSTER     = freecycle-cluster
PROD_API_URL    = https://api.example.com
PROD_WS_URL     = https://api.example.com
```

After a merge to `main` the pipeline:

1. Builds and tests every service (parallel).
2. Builds Docker images, tagged `BRANCH-BUILDNUMBER` and `latest`.
3. Logs in to the registry and pushes both tags.
4. Calls `aws ecs update-service --force-new-deployment` for each service so Fargate pulls the new image.

## 6. Special considerations

### chat-service (Socket.IO)

When you scale chat-service to >1 task, plain socket.io broadcasts only reach clients connected to the same task. Two solutions:

1. **ALB sticky sessions** on the chat-service target group (target type IP, stickiness duration 1 day, app-based or duration-based). Acceptable for ~1k concurrent users.
2. **Redis adapter** for socket.io: `npm i @socket.io/redis-adapter`, then in `src/socket.js` use `io.adapter(createAdapter(pubClient, subClient))`. This is the right answer for production scale.

### S3 bucket policy (public read)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::freecycle-listings-images/*"
    }
  ]
}
```

Combine with CloudFront for caching and cheaper egress.

### Database migrations

For zero-downtime deploys:

1. Add a Jenkins stage `Migrate DB` between `Push to registry` and `Deploy to AWS` that runs an ECS one-off task with `node-pg-migrate up`.
2. Roll forward only - never drop columns in the same release that uses them.

### Logs & observability

Send container logs to CloudWatch Logs (default for Fargate). Use the `pino` JSON output already in place; pipe through CloudWatch Logs Insights for queries.

## 7. Cost-light alternative: single EC2

If ECS Fargate is overkill, you can run the entire `docker-compose.yml` on a single t3.small EC2:

```bash
ssh ec2-user@<host>
sudo yum install -y docker git && sudo systemctl enable --now docker
git clone <repo> && cd <repo>
cp .env.example .env && nano .env       # fill in real RDS/S3 creds
sudo docker compose up -d --build
```

Front it with an ALB or Caddy for HTTPS termination.
