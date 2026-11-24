FROM golang:1.27.4-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /renewal-api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /renewal-api /renewal-api
ENTRYPOINT ["/renewal-api"]
