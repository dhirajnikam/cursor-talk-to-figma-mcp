#!/bin/bash

# Get the absolute path of the current directory
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Create .cursor directory if it doesn't exist
mkdir -p .cursor

# Check if bun is available, otherwise use npm
if command -v bun &> /dev/null; then
    echo "📦 Installing dependencies with bun..."
    bun install
    bun run build
    RUNTIME="bun"
    RUNTIME_CMD="bun"
    SERVER_FILE="$CURRENT_DIR/src/talk_to_figma_mcp/server.ts"
else
    echo "📦 Installing dependencies with npm..."
    npm install
    npm run build
    RUNTIME="node"
    RUNTIME_CMD="node"
    SERVER_FILE="$CURRENT_DIR/dist/server.js"
fi

echo "✅ Dependencies installed and project built"

# Create mcp.json for Cursor with local path
echo "{
  \"mcpServers\": {
    \"TalkToFigma\": {
      \"command\": \"$RUNTIME_CMD\",
      \"args\": [
        \"$SERVER_FILE\"
      ]
    }
  }
}" > .cursor/mcp.json

echo "✅ Cursor MCP config created at .cursor/mcp.json (using $RUNTIME)"

# Detect OS and create Claude Code config
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    CLAUDE_CONFIG_DIR="$APPDATA/Claude"
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
else
    # Linux
    CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
fi

# Ask user if they want to setup Claude Code config
echo ""
echo "Do you want to setup the MCP config for Claude Code? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    # Create Claude config directory if it doesn't exist
    mkdir -p "$CLAUDE_CONFIG_DIR"

    # Create or update Claude Code config
    if [ -f "$CLAUDE_CONFIG_FILE" ]; then
        echo "⚠️  Claude Code config already exists at $CLAUDE_CONFIG_FILE"
        echo "Please manually add the following to your mcpServers section:"
        echo ""
        echo "  \"TalkToFigma\": {"
        echo "    \"command\": \"$RUNTIME_CMD\","
        echo "    \"args\": ["
        echo "      \"$SERVER_FILE\""
        echo "    ]"
        echo "  }"
    else
        echo "{
  \"mcpServers\": {
    \"TalkToFigma\": {
      \"command\": \"$RUNTIME_CMD\",
      \"args\": [
        \"$SERVER_FILE\"
      ]
    }
  }
}" > "$CLAUDE_CONFIG_FILE"
        echo "✅ Claude Code MCP config created at $CLAUDE_CONFIG_FILE (using $RUNTIME)"
    fi
else
    echo "ℹ️  Skipping Claude Code config setup"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "For local development:"
echo "  - Cursor: Config is at .cursor/mcp.json"
echo "  - Claude Code: Config is at $CLAUDE_CONFIG_FILE"
echo "  - Runtime: $RUNTIME"
echo ""
echo "Next steps:"
if [ "$RUNTIME" == "bun" ]; then
    echo "  1. Start the WebSocket server: bun socket"
else
    echo "  1. Start the WebSocket server: npm run socket"
fi
echo "  2. Install the Figma plugin"
echo "  3. Connect and start using!" 