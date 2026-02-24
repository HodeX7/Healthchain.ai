# HealthChain Test Scenarios Documentation

This document outlines the functional requirements and specific assertions for the 182 test cases implemented in `test-all-scenarios.sh`.

## 1. Patient Lifecycle (10 Tests)
**Objective:** Verify that the core identity registration system is robust and prevents collisions.
*   **Successful Registration:** Asserts that `registerPatient` returns the generated ID (P001, P002) and that the public ledger stores basic bio-data (Name, DOB, Blood Group).
*   **Collision Detection:** Expects a failure/error when attempting to register an existing ID (`already exists`).
*   **Profile Updates:** Verifies that a patient can update their own email and that a subsequent `getPatient` query reflects the change immediately.
*   **Negative Lookups:** Asserts that querying a non-existent ID (`PXXX`) returns a "not found" error.

## 2. Consent Management (15 Tests)
**Objective:** Verify the granular access control system (PDC-level consent).
*   **Pending Requests:** Validates that a hospital's `requestAccess` initializes a "pending" state in the public ledger.
*   **Selective Granting:** Asserts that patients can grant access to a subset of Private Data Collections (PDCs) (e.g., only Medical Records, but not Lab Reports).
*   **Consent Revocation:** Verifies that once a patient revokes access, the `checkConsent` status immediately flips to `false`.
*   **Re-granting Log:** Asserts that the system allows re-granting access after a previous revocation, maintaining a proper history.

## 3. Medical Records (20 Tests)
**Objective:** Test the storage and retrieval of sensitive diagnosis data in Private Data Collections.
*   **Encapsulation:** Asserts that records created by Hospital A are stored in Hospital A's PDC and are not visible to other organizations without explicit consent.
*   **Cross-Hospital Reading:** Verifies that if a patient grants Hospital B access to "Hospital A's collection", Hospital B can successfully retrieve the records.
*   **Unauthorized Access:** Explicitly tests that Labs, Pharmacies, and Insurance companies cannot call `queryPatientRecords` (RBAC enforcement).
*   **Short-Circuit Logic:** Includes assertions for the "debug short-circuit" which allows immediate retrieval of the most recent critical record (REC001).

## 4. Lab Workflow (15 Tests)
**Objective:** Verify the diagnostic ordering and reporting loop.
*   **Order Creation:** Asserts that Hospital-created lab orders are visible to the Lab organization in a "pending" state.
*   **Report Linking:** Validates that `uploadLabReport` correctly transitions an order status to `reported` and stores the lab results in a private collection.
*   **Integration:** Asserts that the patient's holistic medical record view includes results from the lab report.

## 5. Prescription Workflow — Gossip Critical (20 Tests)
**Objective:** Verify real-time pharmacy interactions and the system's resilience to network propagation delays.
*   **Issuance:** Asserts that prescriptions contain structured medication data (dosage, duration) and are tied to a patient ID.
*   **Zero-Delay Fulfillment:** Tests the "Retry Logic" by attempting to fulfill a prescription at the Pharmacy peer immediately after issuance at the Hospital peer (0ms delay).
*   **Propagation Windows:** Tests fulfillment at 50ms, 200ms, and 500ms intervals to ensure gossip eventually synchronizes the hashes.
*   **Double-Dip Protection:** Asserts that a prescription cannot be fulfilled twice.

## 6. Insurance Workflow — Gossip Critical (20 Tests)
**Objective:** Validate the private submission and approval of financial claims.
*   **Claim Submission:** Asserts that claims include procedural codes and costs, stored in hospital-specific insurance PDCs.
*   **Financial Logic:** Verifies that `approveClaim` can handle partial approvals (e.g., approving $350 of a $425 claim) and that the balance is correctly recorded.
*   **Denial Reasons:** Asserts that denials correctly store the reason string (e.g., "Pre-existing condition").

## 7. Hospital Switching (10 Tests)
**Objective:** Simulate a patient moving from one provider to another.
*   **Handover:** Verifies that a patient can revoke all access from Hospital A and grant full access to Hospital B, including permission for Hospital B to read the historical data legacy from Hospital A's collections.
*   **Post-Revocation Security:** Asserts that Hospital A can no longer create or read records for the patient after the switch.

## 8. Cross-Org Data Flow (5 Tests)
**Objective:** Test complex interaction chains involving 3+ organizations.
*   **Scenario:** Hospital B issues a prescription $\rightarrow$ Pharmacy (independent Org) fulfills it $\rightarrow$ Audit trail is generated. Asserts that the identity of the issuer is preserved across org boundaries.

## 9. Privacy & Security (15 Tests)
**Objective:** "Negative Testing" of the security boundaries.
*   **Illegal Queries:** Asserts that every role (Lab, Pharmacy, Insurance) is rejected when attempting to call functions outside their domain (e.g., Pharmacy trying to approve a claim).
*   **Identity Impersonation:** Verifies that Hospital A cannot "grant access" to its own collection on behalf of the patient.

## 10. Audit & Compliance (5 Tests)
**Objective:** Regulatory verification.
*   **Tamper-Evidence:** Asserts that every critical action (Grant, Revoke, Upload, Fulfill) generates a corresponding entry in the `getAuditLog` for that patient.

## 11. Error Handling (10 Tests)
**Objective:** Resilience against bad input.
*   **Validation:** Asserts that the system rejects empty IDs, malformed JSON, and invalid timestamps with descriptive error messages.

## 12. Concurrent Operations (8 Tests)
**Objective:** Multi-threading and Race Conditions.
*   **Parallel Prescriptions:** Spawns 5 background processes to issue prescriptions simultaneously. Asserts that the MVCC (Multi-Version Concurrency Control) handles the state updates without data corruption.

## 13. Gossip Stress Test (5 Tests)
**Objective:** High-velocity synchronization.
*   **Stress:** Issues 10 prescriptions and 5 claims in rapid-fire succession. Expects a high pass rate (>80%) for immediate cross-peer availability, proving the "Retry-While-Waiting" logic works under load.

## 14. Data Consistency (7 Tests)
**Objective:** Consensus verification.
*   **Peer Mirroring:** Compares a query for a patient on the Patient Org peer vs. the Hospital Org peer. Asserts that the returned JSON objects are identical.

## 15. Edge Cases (10 Tests)
**Objective:** Rare scenarios and boundary conditions.
*   **Special Characters:** Verifies names like "Jean-Luc O'Brien" don't break JSON parsing.
*   **Payload Limits:** Tests orders with extremely long "Notes" fields (500+ characters).
*   **Initial State:** Asserts that a brand-new patient's record lists and consent history are correctly initialized as empty arrays `[]`.
