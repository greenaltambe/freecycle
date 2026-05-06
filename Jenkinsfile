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

        cat <<EOF > .env
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

GATEWAY_PORT=8080
USER_SERVICE_PORT=4001
LISTING_SERVICE_PORT=4002
LOCATION_SERVICE_PORT=4003
CHAT_SERVICE_PORT=4004
NOTIFICATION_SERVICE_PORT=4005

USER_SERVICE_URL=http://user-service:4001
LISTING_SERVICE_URL=http://listing-service:4002
LOCATION_SERVICE_URL=http://location-service:4003
CHAT_SERVICE_URL=http://chat-service:4004
NOTIFICATION_SERVICE_URL=http://notification-service:4005

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
S3_BUCKET=$S3_BUCKET
S3_ENDPOINT=

VITE_API_BASE_URL=http://65.0.96.112:8080
VITE_WS_URL=http://65.0.96.112:8080
EOF
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
      cp -r * /home/ec2-user/freecycle/

      cd /home/ec2-user/freecycle

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