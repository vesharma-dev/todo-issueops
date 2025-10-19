#!/bin/bash

# Local testing script for TODO Bot
echo "🤖 TODO Bot Local Testing Script"
echo "================================="

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "❌ act is not installed. Please install it with: brew install act"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Function to create a test commit
create_test_commit() {
    echo "📝 Creating test commit with TODO changes..."
    
    # Ensure we're in git repo
    if [ ! -d ".git" ]; then
        git init
        git config user.email "test@example.com"
        git config user.name "Test User"
    fi
    
    # Add current files and create initial commit if needed
    if [ -z "$(git log --oneline 2>/dev/null)" ]; then
        git add .
        git commit -m "Initial commit"
    fi
    
    # Add test files to git
    git add test-files/
    git commit -m "Add test files with TODO comments"
    
    echo "✅ Test commit created"
}

# Function to run act with debug output
run_act_test() {
    echo "🚀 Running TODO Bot with act..."
    echo ""
    
    # Run the dev-test workflow with secrets support
    echo "Running workflow: dev-test.yml"
    if [ -f ".secrets" ]; then
        echo "📁 Using secrets from .secrets file"
        act push -W .github/workflows/dev-test.yml \
            --container-architecture linux/amd64 \
            --secret-file .secrets \
            --artifact-server-path /tmp/artifacts \
            -v
    else
        echo "⚠️  No .secrets file found - running without GitHub token"
        act push -W .github/workflows/dev-test.yml \
            --container-architecture linux/amd64 \
            --artifact-server-path /tmp/artifacts \
            -v
    fi
}

# Function to run act with a GitHub token
run_act_with_token() {
    echo "🔑 Running with GitHub token for API testing..."
    echo "Note: This will make actual API calls to GitHub"
    echo ""
    
    if [ -f ".secrets" ]; then
        echo "📁 Using token from .secrets file"
        run_act_test
    else
        echo "Make sure you have a GitHub Personal Access Token"
        read -p "Enter your GitHub PAT (or press Enter to skip): " github_token
        
        if [ -n "$github_token" ]; then
            act push -W .github/workflows/dev-test.yml \
                --container-architecture linux/amd64 \
                -s GITHUB_TOKEN="$github_token" \
                -v
        else
            echo "Skipping token-based test"
        fi
    fi
}

# Function to simulate file changes
simulate_changes() {
    echo "🔄 Simulating TODO changes..."
    
    # Add a new TODO
    cat >> test-files/user-service.js << 'EOF'

// TODO: Add rate limiting to API calls
function rateLimitCheck() {
  // FIXME: Implement rate limiting logic
  return true;
}
EOF
    
    # Remove a TODO from Python file
    if [ -f "test-files/data_processor.py" ]; then
        sed -i.bak 's/.*TODO: Load configuration from environment.*/        # Configuration loaded/' test-files/data_processor.py
    fi
    
    git add test-files/
    git commit -m "Update TODOs - add new ones, remove some"
    
    echo "✅ TODO changes simulated"
}

# Function to build Docker image locally
build_docker_image() {
    echo "🐳 Building Docker image locally..."
    docker build --platform linux/amd64 -t todo-bot-local . || {
        echo "❌ Docker build failed. Let's try without platform flag..."
        docker build -t todo-bot-local .
    }
    echo "✅ Docker image built: todo-bot-local"
}

# Function to debug build issues
debug_build() {
    echo "🔍 Debug build process..."
    
    echo "1. Testing TypeScript compilation locally:"
    pnpm build || echo "❌ Local build failed"
    
    echo ""
    echo "2. Checking if dist directory was created:"
    ls -la dist/ 2>/dev/null || echo "❌ dist directory not found"
    
    echo ""
    echo "3. Testing Docker build with verbose output:"
    docker build --progress=plain --no-cache -t todo-bot-debug .
}

# Function to clean up artifacts
cleanup() {
    echo "🧹 Cleaning up..."
    rm -rf dist/ lib/
    git checkout main &>/dev/null || git checkout master &>/dev/null
    git branch -D test-single-commit-branch &>/dev/null || true
    rm -f event.json
    docker rmi todo-bot-local 2>/dev/null || true
    docker rmi act-dockeraction:latest 2>/dev/null || true
    echo "✅ Cleanup complete"
}

# Function to simulate a single commit push to a new branch
simulate_single_commit_push() {
    echo "🚀 Simulating single commit push to a new branch..."

    # 1. Ensure we have a base commit to work from
    git checkout main &>/dev/null || git checkout master &>/dev/null
    if [ -z "$(git log --oneline 2>/dev/null)" ]; then
        echo "Creating initial commit on main branch."
        git commit --allow-empty -m "Initial commit"
    fi
    local main_commit
    main_commit=$(git rev-parse HEAD)

    # 2. Create a new branch and a new commit
    git checkout -b test-single-commit-branch
    echo "// TODO: This is a test for a single commit push" > test-files/single-commit-feature.js
    git add test-files/single-commit-feature.js
    git commit -m "feat: Add new feature with a TODO for single commit test"
    
    # 3. Get the new commit SHA and its parent
    local head_commit
    head_commit=$(git rev-parse HEAD)
    local base_commit
    base_commit=$(git rev-parse HEAD^) # Get the parent commit

    # 4. Generate a git diff and save it to a file
    git diff --no-color "$base_commit" "$head_commit" > test.diff
    echo "📄 Created test.diff for local testing"

    # 5. Create the event payload for act
    local repo_full_name
    repo_full_name=$(git config --get remote.origin.url | sed -e 's/.*github.com\///' -e 's/\.git$//' 2>/dev/null) || repo_full_name="test-owner/test-repo"
    
    cat > event.json <<EOF
{
  "ref": "refs/heads/test-single-commit-branch",
  "before": "$base_commit",
  "after": "$head_commit",
  "pusher": {
    "name": "test-user"
  },
  "repository": {
    "full_name": "$repo_full_name",
    "name": "${repo_full_name##*/}",
    "owner": {
      "login": "${repo_full_name%%/*}"
    }
  }
}
EOF

    echo "📄 Created event payload"
    
    # 6. Run act with the specific event
    echo "🚀 Running act for the push event..."
    if [ -f ".secrets" ]; then
        act push -W .github/workflows/dev-test.yml \
            --eventpath event.json \
            --container-architecture linux/amd64 \
            --secret-file .secrets \
            --artifact-server-path /tmp/artifacts \
            -v
    else
        echo "⚠️  No .secrets file found - running without GitHub token"
        act push -W .github/workflows/dev-test.yml \
            --eventpath event.json \
            --container-architecture linux/amd64 \
            --artifact-server-path /tmp/artifacts \
            -v
    fi

    # 7. Clean up
    echo "🧹 Cleaning up test branch and files..."
    git checkout main &>/dev/null || git checkout master &>/dev/null
    git branch -D test-single-commit-branch &>/dev/null || true
    rm -f event.json
    rm -f test.diff
    rm -f test-files/single-commit-feature.js

    echo "✅ Simulation complete."
}

# Main menu
while true; do
    echo ""
    echo "Choose an option:"
    echo "1. Create test commit"
    echo "2. Run basic act test"
    echo "3. Run act with GitHub token"
    echo "4. Simulate TODO changes and test"
    echo "5. Simulate single commit push to new branch"
    echo "6. Build Docker image locally"
    echo "7. Debug build issues"
    echo "8. Clean up artifacts"
    echo "9. View act help"
    echo "10. Exit"
    echo ""
    read -p "Enter your choice [1-10]: " choice
    
    case $choice in
        1)
            create_test_commit
            ;;
        2)
            run_act_test
            ;;
        3)
            run_act_with_token
            ;;
        4)
            simulate_changes
            run_act_test
            ;;
        5)
            simulate_single_commit_push
            ;;
        6)
            build_docker_image
            ;;
        7)
            debug_build
            ;;
        8)
            cleanup
            ;;
        9)
            echo "📖 Act help:"
            act --help
            ;;
        10)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option. Please choose 1-10."
            ;;
    esac
done