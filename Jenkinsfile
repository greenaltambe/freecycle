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
        sh 'git rev-parse --short HEAD'
      }
    }

    stage('Build & Deploy (Docker Compose)') {
      steps {
        sh '''
          echo "Stopping old containers..."
          docker compose down || true

          echo "Building and starting new containers..."
          docker compose up -d --build

          echo "Running containers:"
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