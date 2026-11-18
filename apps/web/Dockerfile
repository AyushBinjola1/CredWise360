FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
ENV CORE_URL=http://core:8787
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
USER node
CMD ["npm","exec","--workspace","apps/web","--","next","start","--hostname","0.0.0.0"]
