FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    iproute2 \
    netcat-openbsd \
    openssh-server \
    procps \
    sudo \
    util-linux \
  && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /usr/local/bin/vr-lab-entrypoint
COPY sshd_config_gateway /etc/ssh/sshd_config_gateway
COPY sshd_config_target /etc/ssh/sshd_config_target

RUN chmod +x /usr/local/bin/vr-lab-entrypoint \
  && mkdir -p /var/run/sshd /run/netns

EXPOSE 2222

ENTRYPOINT ["/usr/local/bin/vr-lab-entrypoint"]
