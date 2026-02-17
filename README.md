# Agent VM

A container-based runtime for AI agents with an embedded [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) resolver. Agent VM gives your agent a sandboxed Linux environment with filesystem and shell access exposed through a standard MCP interface.

## Quick Start

### Build the base image

```bash
docker build -f images/base/Dockerfile -t agent-vm-base .
```

### Run a container

```bash
# Interactive shell with workspace mount
docker run -it --rm -p 7777:7777 -v $(pwd)/my-project:/workspace agent-vm-base

# Detached — MCP resolver only
docker run -d --rm -p 7777:7777 -v $(pwd)/my-project:/workspace agent-vm-base sleep infinity
```

### Verify the resolver is running

```bash
curl http://localhost:7777/health
# {"status":"ok"}
```

### Connect an MCP client

The resolver speaks MCP Streamable HTTP. Point any compatible client at:

```
http://localhost:7777/mcp
```

See the [MCP Resolver documentation](mcp_resolver/README.md) for protocol details and tool reference.

## Using Pre-built Images

```bash
docker pull ghcr.io/sean-lai-sh/agent-vm-base:latest
```

## Documentation

- [MCP Resolver Documentation](mcp_resolver/README.md)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Python SDK

For provisioning and managing Agent VMs programmatically, see [agent-vm-sdk](https://github.com/sean-lai-sh/agent-vm-sdk).

## License

MIT
