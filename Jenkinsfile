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
        sh '''
          echo "Creating .env file..."

          cp .env.example .env

          # Fix frontend URLs for EC2
          sed -i 's|http://localhost:8080|http://65.0.96.112:8080|g' .env
        '''
      }
    }

    stage('Build & Deploy') {
      steps {
        sh '''
          echo "Stopping old containers..."
          docker compose down || true

          echo "Building and starting..."
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