#!/bin/bash
# ==============================================================================
# Script de Despliegue en DigitalOcean Droplet — NEXUS Ecosistema Cognitivo TDAH
# ==============================================================================

set -e

echo "🚀 Iniciando despliegue de NEXUS en DigitalOcean Droplet..."

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
    # Clave para cifrar los secretos en reposo (clave VAPID y contraseña de Gmail). Guárdala también fuera del servidor.
    sed -i "s/^NEXUS_SECRET_KEY=$/NEXUS_SECRET_KEY=$(openssl rand -hex 32)/" .env
    echo "   Revisa .env antes de seguir: NEXUS_ADMIN_USER, NEXUS_ADMIN_PASSWORD y, para HTTPS, NEXUS_DOMAIN."
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
# Con el perfil https (COMPOSE_PROFILES=https y NEXUS_DOMAIN en .env) la entrada es Caddy, con certificado automático
DOMINIO=$(grep -E '^NEXUS_DOMAIN=' .env | head -n 1 | cut -d= -f2- | cut -d, -f1 | tr -d ' "')
PUERTO=$(grep -E '^PORT=' .env | head -n 1 | cut -d= -f2- | tr -d ' "')
if grep -qE '^COMPOSE_PROFILES=.*https' .env && [ -n "$DOMINIO" ]; then
    echo "🌐 Accede a tu servidor en: https://$DOMINIO"
else
    echo "🌐 Accede a tu servidor en: http://$(curl -s ifconfig.me):${PUERTO:-8080}"
    echo "   Sin HTTPS, el móvil no permite avisos push ni micrófono: ver docs/GUIA_PENDIENTES.md, punto 2.2."
fi
echo "💾 Copias de seguridad diarias en el volumen de datos; restaurar con scripts/restaurar-copia.sh"
echo "📊 Para ver logs: docker compose logs -f"
echo "=============================================================================="
