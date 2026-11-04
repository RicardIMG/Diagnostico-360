FROM node:20-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=4173 HOST=0.0.0.0
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json server.mjs ./
COPY src ./src
COPY dist ./dist
COPY scripts ./scripts
RUN chown -R node:node /app
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
