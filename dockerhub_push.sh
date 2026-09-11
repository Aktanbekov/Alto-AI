#!/bin/bash
set -e

# ===== CONFIG =====
DOCKERHUB_USER="aktanov"
IMAGE_NAME="altoai"
SIDECAR_NAME="altoai-visa-llm"
TAG="latest"
PLATFORMS="linux/amd64,linux/arm64"

# ===== CHECKS =====
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed"
  exit 1
fi

echo "✅ Docker found"

# ===== LOGIN CHECK =====
# if ! docker info | grep -q "Username"; then
#   echo "🔐 Please login to Docker Hub"
#   docker login
# fi

# ===== BUILDX SETUP =====
if ! docker buildx inspect multiarch &> /dev/null; then
  echo "🔧 Creating buildx builder"
  docker buildx create --name multiarch --use
else
  docker buildx use multiarch
fi

docker buildx inspect --bootstrap

# ===== BUILD & PUSH =====
# Two images, because the stack is two services. docker-compose.prod.yml pulls
# ${DOCKERHUB_USER}/altoai and ${DOCKERHUB_USER}/altoai-visa-llm, and pushing
# only the first ships a Go backend that calls sidecar routes the deployed
# sidecar has never heard of. They are versioned together for that reason.
echo "🚀 Building and pushing the app image..."
docker buildx build \
  --platform ${PLATFORMS} \
  -t ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG} \
  --push \
  .

echo "✅ Successfully pushed ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"

echo "🚀 Building and pushing the visa-llm sidecar image..."
docker buildx build \
  --platform ${PLATFORMS} \
  -t ${DOCKERHUB_USER}/${SIDECAR_NAME}:${TAG} \
  --push \
  ./visa-llm

echo "✅ Successfully pushed ${DOCKERHUB_USER}/${SIDECAR_NAME}:${TAG}"
