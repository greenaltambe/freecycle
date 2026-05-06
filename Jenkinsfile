pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare .env') {
      steps {
        withCredentials([
          string(credentialsId: 'POSTGRES_PASSWORD', variable: 'POSTGRES_PASSWORD'),
          string(credentialsId: 'JWT_SECRET', variable: 'JWT_SECRET'),
          string(credentialsId: 'AWS_ACCESS_KEY_ID', variable: 'AWS_ACCESS_KEY_ID'),
          string(credentialsId: 'AWS_SECRET_ACCESS_KEY', variable: 'AWS_SECRET_ACCESS_KEY'),
          string(credentialsId: 'S3_BUCKET', variable: 'S3_BUCKET')
        ]) {

          sh '''
            echo "Creating .env securely..."

            cat > .env <<EOF
NODE_ENV=production

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=freecycle
POSTGRES_USER=freecycle
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

REDIS_HOST=redis
REDIS_PORT=6379

JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
S3_BUCKET=$S3_BUCKET
S3_ENDPOINT=
EOF

            echo "===== VERIFYING GENERATED ENV ====="

            grep AWS .env | sed 's/=.*/=***/'

            echo "ACCESS_KEY_LENGTH=${#AWS_ACCESS_KEY_ID}"
            echo "SECRET_KEY_LENGTH=${#AWS_SECRET_ACCESS_KEY}"
          '''
        }
      }
    }

    stage('Build & Deploy') {
      steps {
        sh '''
          echo "Preparing deployment directory..."

          mkdir -p /home/ec2-user/freecycle

          echo "Copying project files..."
          cp -r . /home/ec2-user/freecycle/

          cd /home/ec2-user/freecycle

          echo "Verifying .env..."
          grep AWS .env | sed 's/=.*/=***/'

          echo "Stopping old containers..."
          docker compose down --remove-orphans || true

          echo "Building and starting containers..."
          docker compose up -d --build

          docker ps
        '''
      }
    }

  }

  post {
    always {
      sh 'docker image prune -f || true'
    }

    success {
      echo "Deployment SUCCESS"
    }

    failure {
      echo "Deployment FAILED"
    }
  }
}