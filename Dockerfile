#FROM ubuntu
#RUN apt-get update
#RUN apt-get install -y git nodejs npm nodejs-legacy
#RUN git clone git://github.com/DuoSoftware/DVP-DiameterServer.git /usr/local/src/diameterserver
#RUN cd /usr/local/src/diameterserver; npm install
#CMD ["nodejs", "/usr/local/src/diameterserver/app.js"]

#EXPOSE 8881

FROM node:5.10.0
ARG VERSION_TAG
RUN git clone -b $VERSION_TAG https://github.com/DuoSoftware/DVP-DiameterServer.git /usr/local/src/diameterserver
RUN cd /usr/local/src/diameterserver;
WORKDIR /usr/local/src/diameterserver
RUN npm install
EXPOSE 8891
CMD [ "node", "/usr/local/src/diameterserver/app.js" ]
