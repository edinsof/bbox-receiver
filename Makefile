build:
	docker buildx build --platform linux/arm/v7,linux/arm64/v8,linux/amd64 --tag datagutt/belabox-receiver .

push:
	docker buildx build --push --platform linux/arm/v7,linux/arm64/v8,linux/amd64 --tag datagutt/belabox-receiver .
