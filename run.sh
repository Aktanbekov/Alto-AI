#!/bin/bash

echo "🧪 Running tests before starting servers..."

# Run Go tests from tests folder
echo "📝 Running Go tests..."
if ! go test ./tests/... -v; then
    echo "❌ Tests failed! Fix the issues before starting servers."
    exit 1
fi

echo "✅ All tests passed!"
echo ""
echo "🔄 Restarting backend and frontend..."

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo "🛑 Killing process on port $port (PID: $pid)..."
        kill -9 $pid 2>/dev/null || true
        sleep 1
    else
        echo "✅ Port $port is already free"
    fi
}

# Kill processes on ports 8080 (backend) and 5173 (frontend)
# The visa-llm sidecar that scores answers. Must match VISA_LLM_URL in .env.
VISA_LLM_PORT=8099

echo "🧹 Cleaning up ports..."
kill_port 8080
kill_port 5173
kill_port $VISA_LLM_PORT

# Wait a moment for ports to be fully released
sleep 2

# Cleanup function to kill background processes on script exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill_port 8080
    kill_port 5173
    kill_port $VISA_LLM_PORT
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# Start the evaluator sidecar. The app runs without it, but answers cannot be
# scored, so a failure here is a warning rather than a reason to stop.
if [ -x visa-llm/.venv/bin/visa-llm ]; then
    echo "🚀 Starting visa-llm evaluator on port $VISA_LLM_PORT..."
    (cd visa-llm && .venv/bin/visa-llm serve --port $VISA_LLM_PORT) &
    for i in $(seq 1 20); do
        if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$VISA_LLM_PORT/api/health 2>/dev/null | grep -q 200; then
            echo "✅ Evaluator is up at http://127.0.0.1:$VISA_LLM_PORT"
            break
        fi
        if [ $i -eq 20 ]; then
            echo "⚠️  Evaluator did not start; answers will not be scored."
        fi
        sleep 1
    done
else
    echo "⚠️  visa-llm/.venv not found; answers will not be scored."
    echo "   Set it up: cd visa-llm && uv venv && VIRTUAL_ENV=.venv uv pip install -e '.[rag,web]'"
fi

# Start backend (loads .env via godotenv in main.go)
echo "🚀 Starting backend on port 8080..."
(go run cmd/api/main.go) &
BACKEND_PID=$!

# Wait for backend to listen and respond
echo "⏳ Waiting for backend to be ready..."
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null | grep -q 200; then
        echo "✅ Backend is up at http://localhost:8080"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Backend did not start. Ensure PostgreSQL is running and .env is correct."
        echo "   Try: pg_isready -h localhost -p 5432"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Start frontend
echo "🚀 Starting frontend on port 5173..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "✅ Servers started!"
echo "   Backend:  http://localhost:8080  (Google login: /auth/google)"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait
