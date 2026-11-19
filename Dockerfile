# Lernwerkstatt: App + Schlüssel-Server in einem kleinen Container
FROM node:22.12.0-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY index.html style.css ./
COPY js ./js
COPY server ./server
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/status >/dev/null || exit 1
CMD ["node", "server/server.js"]
