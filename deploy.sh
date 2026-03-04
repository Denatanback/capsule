#!/bin/bash
set -e

echo "=== Capsule VPS Deploy Script ==="
echo ""

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# 2. Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# 3. Create .env if not exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    DB_PASS=$(openssl rand -hex 16)
    JWT_SEC=$(openssl rand -hex 32)
    SERVER_IP=$(curl -s ifconfig.me)
    
    cat > .env << EOF
DB_PASSWORD=$DB_PASS
JWT_SECRET=$JWT_SEC
CLIENT_URL=http://$SERVER_IP:8080
EOF
    echo ".env created with auto-generated secrets"
    echo "Server IP: $SERVER_IP"
fi

# 4. Build and start
echo ""
echo "Building containers..."
docker compose build

echo ""
echo "Starting services..."
docker compose up -d

echo ""
echo "Waiting for services to start..."
sleep 5

# 5. Check status
echo ""
echo "=== Service Status ==="
docker compose ps

echo ""
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "your-server-ip")
echo "=== Capsule is running! ==="
echo "Open: http://$SERVER_IP:8080"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f        # View logs"
echo "  docker compose restart         # Restart all"
echo "  docker compose down            # Stop all"
echo "  docker compose up -d --build   # Rebuild & restart"
