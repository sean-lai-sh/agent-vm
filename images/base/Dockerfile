FROM python:3.10-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    ca-certificates \
    clang \
    curl \
    dirmngr \
    git \
    gnupg \
    jq \
    sudo \
    tini \
    unzip \
    wget \
    zip \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash agent \
  && echo "agent ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/agent \
  && chmod 0440 /etc/sudoers.d/agent

RUN mkdir -p /workspace /opt/agent-vm /etc/agent-vm /tmp/agent-vm /tmp/agent-vm/exec-logs \
  && chown -R agent:agent /workspace /opt/agent-vm /tmp/agent-vm

COPY mcp_resolver/package.json /opt/agent-vm/mcp-resolver/
RUN cd /opt/agent-vm/mcp-resolver \
  && npm install --omit=dev

COPY mcp_resolver /opt/agent-vm/mcp-resolver
COPY mcp_resolver/config/tools.json /etc/agent-vm/tools.json
COPY images/base/entrypoint.sh /usr/local/bin/agent-vm-entrypoint

RUN chmod +x /usr/local/bin/agent-vm-entrypoint

WORKDIR /workspace

ENV AGENT_VM_WORKSPACE=/workspace \
    AGENT_VM_TOOL_CONFIG=/etc/agent-vm/tools.json \
    MCP_PORT=7777 \
    MCP_HOST=0.0.0.0

EXPOSE 7777

USER agent

ENTRYPOINT ["tini", "--", "/usr/local/bin/agent-vm-entrypoint"]
CMD ["bash"]
