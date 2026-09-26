# ===== مرحلة البناء =====
# (نثبّت كل الحزم هنا لأن nest CLI/TypeScript من devDependencies)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ===== مرحلة التشغيل =====
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# تشغيل بمستخدم غير root.
USER node
EXPOSE 3000
# الـ migrations تُطبَّق تلقائياً عند الإقلاع (migrationsRun في الإنتاج).
CMD ["node", "dist/main"]
