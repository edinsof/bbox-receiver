FROM alpine:3.15 as builder

RUN apk update &&\
    apk upgrade &&\ 
    apk add --no-cache linux-headers alpine-sdk cmake tcl openssl-dev zlib-dev

WORKDIR /tmp

# belabox patched srt
#
ARG BELABOX_SRT_VERSION=master
RUN mkdir -p /build; \
    git clone https://github.com/BELABOX/srt.git /build/srt; \
    cd /build/srt; \
    git checkout $BELABOX_SRT_VERSION; \
    ./configure; \
    make -j${nproc}; \
    make install;

# belabox srtla
#
ARG SRTLA_VERSION=main
RUN mkdir -p /build; \
    git clone https://github.com/BELABOX/srtla.git /build/srtla; \
    cd /build/srtla; \
    git checkout $SRTLA_VERSION; \
    make -j${nproc};

RUN cp /build/srtla/srtla_rec /build/srtla/srtla_send /usr/local/bin

# srt-live-server
# Notes
# - adjusted LD_LIBRARY_PATH to include the patched srt lib
# - SRTLA patch applied from https://github.com/b3ck/sls-b3ck-edit/commit/c8ba19289a583d964dc5e54c746e2b24499226f5
# - upstream patch for logging on arm
COPY patches/sls-SRTLA.patch \
    patches/sls-version.patch \
    patches/segv.patch \
    patches/480f73dd17320666944d3864863382ba63694046.patch /tmp/

ENV LD_LIBRARY_PATH /lib:/usr/lib:/usr/local/lib64
ARG SRT_LIVE_SERVER_VERSION=master
RUN set -xe; \
    mkdir -p /build; \
    git clone https://github.com/IRLServer/srt-live-server.git /build/srt-live-server; \
    cd /build/srt-live-server; \
    git checkout $SRT_LIVE_SERVER_VERSION; \
    patch -p1 < /tmp/sls-SRTLA.patch; \
    patch -p1 < /tmp/segv.patch; \
    patch -p1 < /tmp/480f73dd17320666944d3864863382ba63694046.patch; \
    make -j${nproc}; \
    cp bin/* /usr/local/bin;


# runtime container with server
#
FROM node:alpine3.15
ENV LD_LIBRARY_PATH /lib:/usr/lib:/usr/local/lib64
RUN apk add --update --no-cache openssl libstdc++ supervisor perl

COPY --from=builder /usr/local/lib /usr/local/lib
COPY --from=builder /usr/local/include /usr/local/include
COPY --from=builder /usr/local/bin /usr/local/bin

COPY files/sls.conf /etc/sls/sls.conf
COPY files/supervisord.conf /etc/supervisord.conf
COPY files/logprefix /usr/local/bin/logprefix
COPY server/ /app

RUN chmod 755 /usr/local/bin/logprefix;

WORKDIR /app
RUN yarn --frozen-lockfile --production

EXPOSE 5000/udp 8181/tcp 8282/udp 3000/tcp
ENTRYPOINT ["supervisord", "--nodaemon", "--configuration", "/etc/supervisord.conf"]
