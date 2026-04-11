# ---------- STAGE 1: BUILD ----------
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# ---------- STAGE 2: RUNTIME ----------
FROM node:18-alpine
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app /app
RUN chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
