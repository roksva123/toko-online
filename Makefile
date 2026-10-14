.PHONY: help run dev test migrate-up migrate-down migrate-create sqlc lint fmt clean seed

help:
	@echo "Available commands:"
	@echo "  make run              - Run the server"
	@echo "  make dev              - Run with hot reload (requires air)"
	@echo "  make test             - Run tests"
	@echo "  make migrate-up        - Run database migrations up"
	@echo "  make migrate-down      - Run database migrations down"
	@echo "  make migrate-create    - Create a new migration (use: make migrate-create NAME=migration_name)"
	@echo "  make sqlc             - Generate sqlc code"
	@echo "  make seed             - Seed database with initial data"
	@echo "  make lint             - Run linter"
	@echo "  make fmt              - Format code"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make docker-up        - Start docker-compose services"
	@echo "  make docker-down      - Stop docker-compose services"

run:
	@go run ./cmd/api/main.go

dev:
	@which air > /dev/null || go install github.com/cosmtrek/air@latest
	@air

test:
	@go test -v -cover -race ./...

migrate-up:
	@go run ./cmd/migrate/main.go up

migrate-down:
	@go run ./cmd/migrate/main.go down

migrate-create:
	@mkdir -p migrations
	@go run ./cmd/migrate/main.go create $(NAME)

sqlc:
	@sqlc generate

seed:
	@go run ./cmd/seed/main.go

lint:
	@golangci-lint run ./...

fmt:
	@go fmt ./...
	@goimports -w .

clean:
	@rm -rf bin/ dist/

docker-up:
	@docker-compose up -d

docker-down:
	@docker-compose down

docker-logs:
	@docker-compose logs -f

build:
	@CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/api ./cmd/api/main.go
