FROM node:22-slim
WORKDIR /app
COPY standalone.mjs package.json ./
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "standalone.mjs"]
