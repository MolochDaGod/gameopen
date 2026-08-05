# gameopen API — build context = REPO ROOT (preferred for Railway monorepo)
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY server/standalone.mjs /app/standalone.mjs
COPY server/danger-relay.mjs /app/danger-relay.mjs
COPY server/package.json /app/package.json
# content/ only — do NOT COPY artifacts/animator/public (excluded by .railwayignore)
COPY content /app/content

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/api/healthz').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"
CMD ["node", "standalone.mjs"]
