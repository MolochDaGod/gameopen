# gameopen API — zero-dependency Node server
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY server/standalone.mjs server/standalone.mjs
COPY client/public/asset-manifest.json client/public/asset-manifest.json
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/api/healthz').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"
CMD ["node", "server/standalone.mjs"]

