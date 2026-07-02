FROM node:22-alpine

WORKDIR /app

COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY public/ ./public/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.js"]
