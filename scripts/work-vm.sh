#!/bin/bash

# Google Cloud VM Management Script for Development Environment
# This script provides functions to manage a Google Cloud VM for remote development
# Usage: ./work-vm.sh [function_name]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Load environment variables from .env file if it exists
load_env() {
    local env_file="$(dirname "$0")/.env"
    if [ -f "$env_file" ]; then
        log_info "Loading environment variables from .env file"
        # Export variables from .env file (simple key=value format)
        while IFS='=' read -r key value; do
            # Skip empty lines and comments (using POSIX shell compatible syntax)
            case "$key" in
                ''|\#*) continue ;;
            esac
            # Remove quotes from value if present
            value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
            export "$key"="$value"
        done < "$env_file"
    else
        log_warning ".env file not found, using default values"
    fi
}

set -e  # Exit on any error

# Load environment variables first
load_env

# Check if gcloud is installed and authenticated
check_gcloud() {
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first:"
        log_error "https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 > /dev/null 2>&1; then
        log_error "You are not authenticated with Google Cloud. Please run:"
        log_error "gcloud auth login"
        exit 1
    fi

    # Ensure correct project is set
    ensure_project
}

wait_for_vm_ready() {
    log_info "Waiting for it to reach RUNNING status..."

    # Loop until the VM status is RUNNING
    while [[ "$(gcloud compute instances describe "$VM_NAME" \
                --zone="$ZONE" \
                --project="$PROJECT_ID" \
                --format='value(status)' 2>/dev/null)" != "RUNNING" ]]; do
        log_info "VM status is not yet RUNNING. Waiting 10 seconds..."
        sleep 10
    done
}

# Ensure the correct Google Cloud project is active
ensure_project() {
    local current_project
    current_project=$(gcloud config get-value project 2>/dev/null)

    if [ -z "$PROJECT_ID" ]; then
        if [ -z "$current_project" ]; then
            log_error "No Google Cloud project is set."
            log_error "Please set your project ID in the .env file:"
            log_error "PROJECT_ID=your-project-id"
            log_error "Or run: gcloud config set project YOUR_PROJECT_ID"
            exit 1
        else
            PROJECT_ID="$current_project"
            log_info "Using current active project: $PROJECT_ID"
        fi
    else
        if [ "$PROJECT_ID" != "$current_project" ]; then
            log_info "Switching to project: $PROJECT_ID"
            if ! gcloud config set project "$PROJECT_ID" 2>/dev/null; then
                log_error "Failed to switch to project: $PROJECT_ID"
                log_error "Please check that the project exists and you have access to it."
                exit 1
            fi
            log_success "Successfully switched to project: $PROJECT_ID"
        else
            log_info "Using configured project: $PROJECT_ID"
        fi
    fi
}

# Function 1: Create and start a new VM from scratch
create_vm() {
    log_info "Creating new VM for development environment..."
    check_gcloud

    # Create firewall rule to allow necessary ports
    log_info "Creating firewall rule for development ports..."
    gcloud compute firewall-rules create "$FIREWALL_RULE" \
        --allow tcp:22,tcp:3000,tcp:5173,tcp:8080 \
        --source-ranges 0.0.0.0/0 \
        --description "Allow SSH and development server ports" \
        --project "$PROJECT_ID" 2>/dev/null || log_warning "Firewall rule may already exist"

    # Create the VM instance
    log_info "Creating VM instance: $VM_NAME"

    # Create a temporary startup script file (POSIX shell compatible)
    STARTUP_SCRIPT=$(mktemp)
    cat > "$STARTUP_SCRIPT" << 'EOF'
#!/bin/bash
# Install Node.js, Docker, and development tools
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential git curl wget

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install VS Code Server prerequisites
sudo apt-get install -y net-tools

# Create development user and setup directories
sudo useradd -m -s /bin/bash devuser || true
sudo mkdir -p /home/devuser/workspace
sudo chown -R devuser:devuser /home/devuser/workspace

echo "VM setup complete!"
EOF

    gcloud compute instances create "$VM_NAME" \
        --zone="$ZONE" \
        --machine-type="$MACHINE_TYPE" \
        --network-tier=PREMIUM \
        --maintenance-policy=MIGRATE \
        --image-family="$IMAGE_FAMILY" \
        --image-project="$IMAGE_PROJECT" \
        --boot-disk-size=50GB \
        --boot-disk-type=pd-standard \
        --boot-disk-device-name="$VM_NAME" \
        --metadata-from-file startup-script="$STARTUP_SCRIPT" \
        --project "$PROJECT_ID"

    # Clean up temporary file
    rm -f "$STARTUP_SCRIPT"
    
    log_info "VM is being created."
    wait_for_vm_ready
    show_vm_info
}

# Function 2: Start an existing VM
start_vm() {
    log_info "Starting existing VM: $VM_NAME"
    check_gcloud

    # Check if VM exists
    if ! gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --project "$PROJECT_ID" &>/dev/null; then
        log_error "VM $VM_NAME does not exist in zone $ZONE"
        log_error "Use 'create_vm' function to create a new VM first"
        exit 1
    fi

    # Start the VM
    gcloud compute instances start "$VM_NAME" --zone="$ZONE" --project "$PROJECT_ID"

    log_info "VM is starting."
    wait_for_vm_ready
    show_vm_info
}

show_vm_info() {
    # Check if VM exists
    if ! gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --project "$PROJECT_ID" &>/dev/null; then
        log_error "VM $VM_NAME does not exist in zone $ZONE"
        exit 1
    fi

    # Get the external IP
    EXTERNAL_IP=$(gcloud compute instances describe "$VM_NAME" \
        --zone="$ZONE" \
        --project "$PROJECT_ID" \
        --format="get(networkInterfaces[0].accessConfigs[0].natIP)")

    log_success "VM connection information:"
    log_info "External IP: $EXTERNAL_IP"
    log_info "SSH connection: ssh $SSH_USER@$EXTERNAL_IP"
    log_info "To connect with VS Code:"
    log_info "1. Install 'Remote - SSH' extension in VS Code"
    log_info "2. Use: Connect to Host: $SSH_USER@$EXTERNAL_IP"
    log_info "3. Port forward: localhost:5173 -> localhost:5173 for Vite dev server"
}

# Function 3: Stop VM (but keep it for storage costs)
stop_vm() {
    log_info "Stopping VM: $VM_NAME (keeping storage)"
    check_gcloud

    # Check if VM exists
    if ! gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --project "$PROJECT_ID" &>/dev/null; then
        log_error "VM $VM_NAME does not exist in zone $ZONE"
        exit 1
    fi

    # Stop the VM
    gcloud compute instances stop "$VM_NAME" --zone="$ZONE" --project "$PROJECT_ID"

    log_success "VM stopped successfully!"
    log_info "VM is now stopped. You'll only be charged for storage."
    log_info "Use 'start_vm' function to start it again when needed."
}

# Function 4: Stop and delete everything completely
delete_vm() {
    log_warning "This will permanently delete the VM and all associated resources!"
    read -p "Are you sure you want to delete everything? (yes/no): " -r
    # Check if user confirmed (using POSIX shell compatible syntax)
    case "$REPLY" in
        [Yy][Ee][Ss]) ;;
        *) log_info "Operation cancelled."; exit 0 ;;
    esac

    log_info "Deleting VM and all resources: $VM_NAME"
    check_gcloud

    # Check if VM exists
    if ! gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --project "$PROJECT_ID" &>/dev/null; then
        log_warning "VM $VM_NAME does not exist in zone $ZONE"
    else
        # Stop the VM first if it's running
        log_info "Stopping VM before deletion..."
        gcloud compute instances stop "$VM_NAME" --zone="$ZONE" --project "$PROJECT_ID" 2>/dev/null || true

        # Delete the VM
        log_info "Deleting VM instance..."
        gcloud compute instances delete "$VM_NAME" --zone="$ZONE" --project "$PROJECT_ID" --quiet
    fi

    # Delete firewall rule if it exists
    if gcloud compute firewall-rules describe "$FIREWALL_RULE" --project "$PROJECT_ID" &>/dev/null; then
        log_info "Deleting firewall rule..."
        gcloud compute firewall-rules delete "$FIREWALL_RULE" --project "$PROJECT_ID" --quiet
    fi

    # Delete boot disk if it exists
    DISK_NAME="$VM_NAME"
    if gcloud compute disks describe "$DISK_NAME" --zone="$ZONE" --project "$PROJECT_ID" &>/dev/null; then
        log_info "Deleting boot disk..."
        gcloud compute disks delete "$DISK_NAME" --zone="$ZONE" --project "$PROJECT_ID" --quiet
    fi

    log_success "All resources deleted successfully!"
    log_info "Everything has been cleaned up. No charges will accrue."
}

# Show usage if no function is provided
usage() {
    echo "Usage: $0 [function_name]"
    echo ""
    echo "Functions:"
    echo "  create_vm    Create a new VM from scratch with development tools"
    echo "  start_vm     Start an existing VM"
    echo "  stop_vm      Stop VM (keep for storage costs)"
    echo "  delete_vm    Stop and delete everything completely"
    echo "  show_vm_info Show connection info for existing VM"
    echo ""
    echo "Examples:"
    echo "  $0 create_vm    # Create new development VM"
    echo "  $0 start_vm     # Start existing VM"
    echo "  $0 stop_vm      # Stop VM for the day"
    echo "  $0 delete_vm    # Delete everything (use with caution)"
    echo "  $0 show_vm_info # Show connection info for existing VM"
}

# Main script logic
main() {
    if [ $# -eq 0 ]; then
        usage
        exit 1
    fi

    case "$1" in
        create_vm)
            create_vm
            ;;
        start_vm)
            start_vm
            ;;
        stop_vm)
            stop_vm
            ;;
        delete_vm)
            delete_vm
            ;;
        show_vm_info)
            show_vm_info
            ;;
        *)
            log_error "Unknown function: $1"
            usage
            exit 1
            ;;
    esac
}

# Run the main function with all arguments
main "$@"