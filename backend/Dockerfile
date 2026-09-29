FROM node:22-bookworm-slim

# zip: Lambda にアップロードする zip の作成用
RUN apt-get update \
  && apt-get install -y --no-install-recommends zip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["node", "--watch", "local/server.js"]
