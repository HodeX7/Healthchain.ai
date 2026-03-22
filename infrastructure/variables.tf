variable "project_id" {
  description = "The GCP Project ID."
  type        = string
}

variable "region" {
  description = "The GCP region (e.g. us-central1)."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone (e.g. us-central1-a)."
  type        = string
  default     = "us-central1-a"
}

variable "bucket_name" {
  description = "Global unique name for the GCS PDF Storage bucket."
  type        = string
}
