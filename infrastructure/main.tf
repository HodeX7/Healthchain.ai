provider "google" {
  project     = var.project_id
  region      = var.region
  zone        = var.zone
}

# 1. Google Cloud Storage Bucket for PDFs
resource "google_storage_bucket" "secure_docs" {
  name          = var.bucket_name
  location      = upper(var.region)
  force_destroy = true
  uniform_bucket_level_access = true
  
  public_access_prevention = "enforced"

  cors {
    origin          = ["http://localhost:3000", "http://localhost:8080", "*"]
    method          = ["GET", "PUT", "POST", "OPTIONS"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

# 2. Firewall Rules to allow API traffic and SSH
resource "google_compute_firewall" "allow_api_and_ssh" {
  name    = "healthchain-allow-api-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22", "3000"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["healthchain-server"]
}

# 3. Dedicated Compute Engine VM for Hyperledger + Node.js
resource "google_compute_instance" "healthchain_vm" {
  name         = "healthchain-production-node"
  machine_type = "e2-standard-4"
  zone         = var.zone

  tags = ["healthchain-server"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 60
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  service_account {
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = file("startup.sh")
}

output "vm_external_ip" {
  value = google_compute_instance.healthchain_vm.network_interface[0].access_config[0].nat_ip
  description = "Connect to your API using this IP on port 3000"
}

output "gcs_bucket_name" {
  value = google_storage_bucket.secure_docs.name
}
