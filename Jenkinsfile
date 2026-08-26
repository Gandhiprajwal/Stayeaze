pipeline {
    agent any

    options {
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15'))
        ansiColor('xterm')
        disableConcurrentBuilds()
    }

    tools {
        jdk 'JDK-21'
        maven 'Maven-3.9'
        nodejs 'NodeJS-20'
    }

    stages {
        stage('1. Environment & Tools Verification') {
            steps {
                script {
                    echo "=========================================================="
                    echo "🧪 StayEaze Build & Test Verification Suite"
                    echo "📌 Build Number: ${env.BUILD_NUMBER}"
                    echo "📌 Branch:       ${env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'local'}"
                    echo "📌 Commit:       ${env.GIT_COMMIT?.take(7) ?: 'N/A'}"
                    echo "=========================================================="

                    sh 'java -version || true'
                    sh 'mvn -version || true'
                    sh 'node -v || true'
                    sh 'npm -v || true'
                }
            }
        }

        stage('2. Parallel Automated Tests & Builds') {
            parallel {
                stage('Backend: JUnit & Integration Tests') {
                    steps {
                        dir('backend') {
                            echo "🧪 Running Backend Tests (Spring Boot + PostgreSQL)..."
                            sh 'mvn clean test -B'
                        }
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'backend/target/surefire-reports/*.xml'
                        }
                    }
                }

                stage('Web App: TypeScript Check & Production Build') {
                    steps {
                        dir('stayeaze-web') {
                            echo "📦 Verifying stayeaze-web (React + Vite + TypeScript)..."
                            sh 'npm ci'
                            sh 'npm run build'
                        }
                    }
                }

                stage('Frontend Portal: Build Verification') {
                    steps {
                        dir('frontend') {
                            echo "📦 Verifying frontend portal (React + Vite)..."
                            sh 'npm ci'
                            sh 'npm run build'
                        }
                    }
                }
            }
        }

        stage('3. Backend: Production JAR Compilation') {
            steps {
                dir('backend') {
                    echo "📦 Compiling and Packaging Backend Production JAR..."
                    sh 'mvn package -DskipTests=true -B'
                }
            }
            post {
                success {
                    archiveArtifacts artifacts: 'backend/target/*.jar', fingerprint: true, allowEmptyArchive: true
                }
            }
        }
    }

    post {
        always {
            echo "🧹 Cleaning temporary workspace..."
            cleanWs deleteDirs: true, notFailBuild: true
        }
        success {
            echo "============================================================="
            echo "✅ ALL BUILDS & TESTS PASSED SUCCESSFULLY!"
            echo "✅ Backend (Spring Boot Java 21) compile & tests: PASSED"
            echo "✅ Web App (stayeaze-web) TypeScript build:       PASSED"
            echo "✅ Frontend Portal build:                         PASSED"
            echo "============================================================="
        }
        failure {
            echo "============================================================="
            echo "❌ BUILD OR TEST FAILED! Please inspect the logs above."
            echo "============================================================="
        }
    }
}
