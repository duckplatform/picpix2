FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Installe le client MySQL pour les scripts d'initialisation
RUN apt-get update \
    && apt-get install -y --no-install-recommends default-mysql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*