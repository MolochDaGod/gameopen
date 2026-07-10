# gameopen API — standalone Node server + content SSOT
# Railway service root directory is `server/` (see dashboard).
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY standalone.mjs package.json ./
# content/ mirrored into server/content by repo (sync with root content/)
COPY content ./content

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/api/healthz').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"
CMD ["node", "standalone.mjs"]
