#!/bin/bash
set -e

# ===== CONFIG =====
DOCKERHUB_USER="aktanov"
IMAGE_NAME="altoai"
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
echo "🚀 Building and pushing multi-arch image..."
docker buildx build \
  --platform ${PLATFORMS} \
  -t ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG} \
  --push \
  .

echo "✅ Successfully pushed ${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"
