SHELL := /bin/bash

BACKEND_DIR := backend
FRONTEND_DIR := frontend
BACKEND_VENV := $(BACKEND_DIR)/.venv
BACKEND_PYTHON := $(BACKEND_VENV)/bin/python
UV_CACHE_DIR := $(BACKEND_DIR)/.uv-cache
UV_BIN := $(shell command -v uv 2>/dev/null)
PYTHON ?= python3

.PHONY: help backend-venv backend-install backend-run backend-migrate backend-test \
        frontend-install frontend-dev frontend-build frontend-lint \
        docker-build docker-up docker-down docker-logs docker-log check

help:
	@echo "Available targets:"
	@echo "  backend-install   Create venv (uv if available) and install backend deps"
	@echo "  backend-run       Start Django dev server on 0.0.0.0:8000"
	@echo "  backend-migrate   Run Django migrations"
	@echo "  backend-test      Execute Django test suite"
	@echo "  frontend-install  Install npm dependencies"
	@echo "  frontend-dev      Start Vite dev server (localhost:5173)"
	@echo "  frontend-build    Build production assets"
	@echo "  frontend-lint     Run ESLint checks"
	@echo "  docker-build      Build docker-compose services"
	@echo "  docker-up         Start docker-compose stack in background"
	@echo "  docker-down       Stop docker-compose stack"
	@echo "  docker-logs       Follow docker-compose logs"
	@echo "  docker-log        Same as docker-logs (alias)"
	@echo "  check             Run backend tests + frontend lint"

backend-venv:
ifdef UV_BIN
	cd $(BACKEND_DIR) && if [ ! -d .venv ]; then mkdir -p .uv-cache && UV_CACHE_DIR=.uv-cache uv venv .venv; fi
else
	if [ ! -d "$(BACKEND_VENV)" ]; then $(PYTHON) -m venv $(BACKEND_VENV); fi
endif

backend-install: backend-venv
ifdef UV_BIN
	cd $(BACKEND_DIR) && mkdir -p .uv-cache && UV_CACHE_DIR=.uv-cache uv pip install -r requirements.txt
else
	cd $(BACKEND_DIR) && $(BACKEND_PYTHON) -m pip install -r requirements.txt
endif

backend-run: backend-install
	$(BACKEND_PYTHON) $(BACKEND_DIR)/manage.py runserver 0.0.0.0:8000

backend-migrate: backend-install
	$(BACKEND_PYTHON) $(BACKEND_DIR)/manage.py migrate

backend-test: backend-install
	$(BACKEND_PYTHON) $(BACKEND_DIR)/manage.py test

frontend-install:
	cd $(FRONTEND_DIR) && npm install

frontend-dev: frontend-install
	cd $(FRONTEND_DIR) && npm run dev

frontend-build: frontend-install
	cd $(FRONTEND_DIR) && npm run build

frontend-lint: frontend-install
	cd $(FRONTEND_DIR) && npm run lint

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-log: docker-logs

check: backend-test frontend-lint
