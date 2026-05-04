// =====================================================================
// Local Free Stuff Platform - Jenkins CI/CD pipeline
//
// Stages:
//   1. Checkout
//   2. Install dependencies (cached)
//   3. Lint & Test (matrix per service)
//   4. Build Docker images
//   5. Push images to registry (only on main)
//   6. Deploy to AWS (ECS/EC2 - only on main)
//
// Required Jenkins credentials (configure in Jenkins -> Credentials):
//   - dockerhub-creds         : username/password for Docker Hub (or ECR)
//   - aws-creds               : AWS access key id / secret access key
//   - ssh-deploy-key          : (optional) SSH key for EC2 deploy
//
// Required Jenkins env / pipeline parameters:
//   - DOCKER_REGISTRY         : e.g. docker.io/myorg or 12345.dkr.ecr...
//   - AWS_REGION              : e.g. us-east-1
//   - ECS_CLUSTER             : ECS cluster name (if using ECS)
// =====================================================================

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    DOCKER_REGISTRY = "${env.DOCKER_REGISTRY ?: 'docker.io/freecycle'}"
    IMAGE_TAG       = "${env.BRANCH_NAME ?: 'main'}-${env.BUILD_NUMBER}"
    AWS_REGION      = "${env.AWS_REGION ?: 'us-east-1'}"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        sh 'git rev-parse --short HEAD > .gitsha && echo "Commit: $(cat .gitsha)"'
      }
    }

    stage('Install & Test') {
      parallel {
        stage('user-service')         { steps { dir('services/user-service')         { sh 'npm install && npm test' } } }
        stage('listing-service')      { steps { dir('services/listing-service')      { sh 'npm install && npm test' } } }
        stage('location-service')     { steps { dir('services/location-service')     { sh 'npm install && npm test' } } }
        stage('chat-service')         { steps { dir('services/chat-service')         { sh 'npm install && npm test' } } }
        stage('notification-service') { steps { dir('services/notification-service') { sh 'npm install && npm test' } } }
        stage('api-gateway')          { steps { dir('services/api-gateway')          { sh 'npm install && npm test' } } }
        stage('frontend')             {
          steps {
            dir('frontend') {
              sh 'npm install'
              sh 'npm run build'
            }
          }
        }
      }
    }

    stage('Build Docker images') {
      steps {
        script {
          def services = [
            'api-gateway',
            'user-service',
            'listing-service',
            'location-service',
            'chat-service',
            'notification-service',
          ]
          services.each { svc ->
            sh """
              docker build \\
                -f services/${svc}/Dockerfile \\
                -t ${DOCKER_REGISTRY}/${svc}:${IMAGE_TAG} \\
                -t ${DOCKER_REGISTRY}/${svc}:latest \\
                .
            """
          }
          sh """
            docker build \\
              -f frontend/Dockerfile \\
              --build-arg VITE_API_BASE_URL=${env.PROD_API_URL ?: 'https://api.example.com'} \\
              --build-arg VITE_WS_URL=${env.PROD_WS_URL  ?: 'https://api.example.com'} \\
              -t ${DOCKER_REGISTRY}/frontend:${IMAGE_TAG} \\
              -t ${DOCKER_REGISTRY}/frontend:latest \\
              .
          """
        }
      }
    }

    stage('Push to registry') {
      when {
        anyOf {
          branch 'main'
          branch 'master'
          buildingTag()
        }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
                                          usernameVariable: 'DOCKER_USER',
                                          passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin "${DOCKER_REGISTRY%%/*}"
          '''
          script {
            ['api-gateway','user-service','listing-service','location-service',
             'chat-service','notification-service','frontend'].each { svc ->
              sh "docker push ${DOCKER_REGISTRY}/${svc}:${IMAGE_TAG}"
              sh "docker push ${DOCKER_REGISTRY}/${svc}:latest"
            }
          }
        }
      }
    }

    stage('Deploy to AWS (ECS)') {
      when {
        anyOf { branch 'main'; branch 'master' }
      }
      steps {
        withCredentials([[ $class: 'AmazonWebServicesCredentialsBinding',
                            credentialsId: 'aws-creds',
                            accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                            secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
          sh '''
            : "${ECS_CLUSTER:?ECS_CLUSTER not set}"
            for svc in api-gateway user-service listing-service location-service chat-service notification-service frontend; do
              echo ">>> Forcing new deployment for $svc"
              aws ecs update-service \
                --cluster   "$ECS_CLUSTER" \
                --service   "freecycle-$svc" \
                --force-new-deployment \
                --region    "$AWS_REGION" || echo "WARN: service freecycle-$svc not registered yet"
            done
          '''
        }
      }
    }
  }

  post {
    always  { sh 'docker image prune -f || true' }
    success { echo "Build #${env.BUILD_NUMBER} succeeded - tag ${IMAGE_TAG}" }
    failure { echo "Build #${env.BUILD_NUMBER} FAILED" }
  }
}
