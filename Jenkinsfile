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
          echo "Preparing deployment directory..."

          mkdir -p /home/ec2-user/freecycle

          echo "Copying project to deployment directory..."
          rsync -av --delete ./ /home/ec2-user/freecycle/

          cd /home/ec2-user/freecycle

          echo "Creating .env..."
          cp .env.example .env

          sed -i 's|http://localhost:8080|http://65.0.96.112:8080|g' .env
        '''
      }
    }

    stage('Build & Deploy') {
      steps {
        sh '''
          cd /home/ec2-user/freecycle

          echo "Stopping old containers..."
          docker compose down --remove-orphans || true

          echo "Building and starting containers..."
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