#!/bin/bash
# ==============================================================================
# Script de Despliegue en DigitalOcean Droplet — Proyectazo FocusFlow OS
# ==============================================================================

set -e

echo "🚀 Iniciando despliegue de Proyectazo en DigitalOcean Droplet..."

# 1. Actualizar paquetes del sistema
echo "📦 Actualizando paquetes de Ubuntu/Debian..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Verificar e instalar Docker si no está presente
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# 3. Verificar e instalar Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "🔧 Instalando Docker Compose Plugin..."
    sudo apt-get install -y docker-compose-plugin
fi

# 4. Configurar variables de entorno
if [ ! -f .env ]; then
    echo "⚙️ Creando archivo .env a partir de .env.example..."
    cp .env.example .env
    # Generar password aleatoria si es default
    RAND_PASS=$(openssl rand -hex 16)
    sed -i "s/tu_password_segura_aqui_2026/$RAND_PASS/g" .env
fi

# 5. Configurar Firewall (UFW)
echo "🛡️ Configurando UFW (Puertos 22, 80, 443)..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

# 6. Levantar contenedores con Docker Compose
echo "🏗️ Construyendo y levantando servicios en Docker..."
docker compose down || true
docker compose up -d --build

echo ""
echo "=============================================================================="
echo "✅ ¡Despliegue completado con éxito!"
echo "🌐 Accede a tu servidor en: http://$(curl -s ifconfig.me)"
echo "📊 Para ver logs: docker compose logs -f"
echo "=============================================================================="
