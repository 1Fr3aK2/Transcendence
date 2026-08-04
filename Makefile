NODE_BIN = ./backend/node_modules/.bin

NPM = npm --prefix backend

DOCKER_COMPOSE = docker compose

SCRIPT_CERTS = ./scripts/setup-certs.sh
COMPOSE = docker compose -f ./docker-compose.yml

SERVICES = nginx nginx_exporter vault grafana prometheus redis redis_exporter postgres postgres_exporter

all: deps build up
	@echo "Transcendence started!"

deps:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	cd backend && npx prisma generate

build:
	@echo "Building images..."
	$(SCRIPT_CERTS)
	$(COMPOSE) build

up:
	@echo "Upping all the containers..."
	$(COMPOSE) up -d

down:
	@echo "Stopping and removing containers..."
	$(COMPOSE) down

dev:
	@echo "Iniciando localmente em modo de desenvolvimento..."
	$(NPM) run start:dev

clean:
	@echo "Cleaning Docker..."
	@echo "Limpando a pasta dist..."
	@if [ -d "backend/dist" ]; then \
		rm -rf backend/dist 2>/dev/null || sudo rm -rf backend/dist; \
	fi
	$(COMPOSE) down
	docker system prune -f

fclean: clean
	@echo "Full cleaning Docker..."
	-docker stop $$(docker ps -qa)
	-docker rm $$(docker ps -qa)
	-docker rmi -f $$(docker images -qa)
	-docker volume rm $$(docker volume ls -q)
	-docker network rm $$(docker network ls -q) 2>/dev/null
	sudo rm -rf nginx/certs/
	sudo rm -rf vault/certs/
	$(COMPOSE) down -v

logs:
	@echo "Check specific service logs (ex: make logs SERVICE=backend)"
	$(COMPOSE) logs -f $(SERVICE)

exec:
	@echo "Entering on the container (ex: make exec SERVICE=backend)"
	$(COMPOSE) exec $(SERVICE) sh

re: fclean deps build up
	@echo "Restarting all the containers..."

.PHONY: all build deps up down dev clean fclean logs exec re