FROM node:8-alpine

RUN mkdir -p /opt/qd-oozie

WORKDIR /opt/qd-oozie

COPY . .

RUN npm install --producton && rm yarn.lock

ENTRYPOINT [ "node" ]
CMD [ "./dist/index.js" ]