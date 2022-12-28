FROM ubuntu:latest

# Broken into pieces to make rerunning faster.
VOLUME /opt/local

# For running the node server inside the container.
EXPOSE 3000 8000 8080

ENV N_PREFIX=/tmp/.n

RUN echo "installing binary dependencies" \
    && apt-get update \
    && apt-get install -y npm curl inkscape \
    && echo "complete"

RUN echo "Setup user" \
    && addgroup --gid 1000 local \
    && adduser --system --uid 1000 -gid 1000 local \
    && chown 1000:1000 /opt/local

RUN echo "installing node dependencies" \
    && npm install -g n \
    && echo '#!/bin/bash' > /usr/local/bin/npm \
    && echo 'n exec 19.1.0 npm "$@"' >> /usr/local/bin/npm \
    && echo '#!/bin/bash' > /usr/local/bin/node \
    && echo 'n run 19.1.0 "$@"' >> /usr/local/bin/node \
    && chmod +x /usr/local/bin/* \
    && echo "complete"

USER local

RUN echo "installing n as a local user" \
    && n 19.1.0 \
    && n exec 19.1.0 npm install -g npm@9.1.2 \
    && n exec 19.1.0 node --version \
    && echo "complete"

WORKDIR /opt/local

ENTRYPOINT [ "/bin/bash" ]
