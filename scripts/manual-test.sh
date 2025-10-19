#!/bin/bash

# Quick manual test for TODO Bot development
echo "🧪 Quick TODO Bot Test"
echo "====================="

# Check if we have a GitHub token for testing
if [ -f ".secrets" ] && grep -q "GITHUB_TOKEN=" .secrets; then
    echo "📝 Loading GitHub token from .secrets file..."
    source .secrets
elif [ -n "$GITHUB_TOKEN" ]; then
    echo "📝 Using GitHub token from environment..."
else
    echo "⚠️  No GitHub token found. Using fake token for syntax testing only."
    export GITHUB_TOKEN="fake-token-for-testing"
fi

# Ensure we have the compiled code
if [ ! -f "dist/index.js" ]; then
    echo "📦 Building TypeScript code..."
    pnpm build
fi

# Set up environment variables for testing
export INPUT_TOKEN="$GITHUB_TOKEN"
export INPUT_KEYWORDS="TODO,FIXME,HACK"
export INPUT_LABELS="todo-bot,test"

# Mock GitHub context (this won't work for real API calls but tests the parsing logic)
export GITHUB_REPOSITORY="test-owner/test-repo"
export GITHUB_SHA="abc123"
export GITHUB_EVENT_NAME="push"
export GITHUB_EVENT_PATH="/tmp/mock-event.json"

# Create a mock GitHub event payload
cat > /tmp/mock-event.json << 'EOF'
{
  "before": "0000000000000000000000000000000000000000",
  "after": "abc123def456",
  "repository": {
    "name": "test-repo",
    "owner": {
      "login": "test-owner"
    }
  },
  "head_commit": {
    "id": "abc123def456"
  }
}
EOF

echo "🚀 Running TODO Bot logic..."
if [ "$GITHUB_TOKEN" = "fake-token-for-testing" ]; then
    echo "Note: This will fail at GitHub API calls since we're using fake tokens"
    echo "But it will test the parsing and setup logic"
fi
echo ""

# Run the compiled JavaScript
node dist/index.js

echo ""
if [ "$GITHUB_TOKEN" = "fake-token-for-testing" ]; then
    echo "✅ Test completed. Check output above for any parsing errors."
    echo "For full testing with real GitHub API:"
    echo "  1. Create a GitHub Personal Access Token: https://github.com/settings/tokens"
    echo "  2. Add it to .secrets file: echo 'GITHUB_TOKEN=your_token_here' > .secrets"
    echo "  3. Run this script again, or use './local-test.sh' with act."
else
    echo "✅ Test completed with real GitHub token."
fi