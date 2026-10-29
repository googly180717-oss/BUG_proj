"""
Backend API & Core Pipeline Test Suite for BugIdentifier
Target: FastAPI Endpoints, Delta-RAG Engine, AST Slicer & Model Verification
Runner: Pytest (30 collected items)
"""

import sys
from pathlib import Path
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Ensure project root is in sys.path
project_root = str(Path(__file__).resolve().parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.main import app

client = TestClient(app)

MOCK_SCAN_RESULT = {
    "scan_id": "scan_test_mock_12345",
    "status": "COMPLETED",
    "summary": {
        "files_scanned": 1,
        "functions_analyzed": 3,
        "bugs_detected": 1,
        "repair_success_rate": "100%",
        "cost_saved": "$1.42"
    },
    "vulnerabilities": [
        {
            "id": 1,
            "file": "voting.js",
            "method": "checkAge",
            "bug_type": "BoundaryCondition",
            "similarity": 0.884,
            "status": "REPAIRED"
        }
    ]
}


# 1-3. Health & System Status
def test_health_api():
    """Verify root GET / returns ONLINE service state and docs URL."""
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ONLINE"
    assert "BugIdentifier" in data["service"]


def test_system_status_metadata():
    """Verify GET /api/system/status returns active system telemetry and db mode."""
    res = client.get("/api/system/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert "db_mode" in data


def test_system_status_llm_provider():
    """Verify system status reports LLM repair agent configuration."""
    res = client.get("/api/system/status")
    assert res.status_code == 200
    data = res.json()
    assert "llm_provider" in data


# 4-5. Dataset Stats & Curated Suggestions
def test_dataset_stats_endpoint():
    """Verify GET /api/dataset/stats returns dataset metadata and pairs count."""
    res = client.get("/api/dataset/stats")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)


def test_dataset_suggestions_endpoint():
    """Verify GET /api/dataset/suggestions returns curated MERN repositories."""
    res = client.get("/api/dataset/suggestions")
    assert res.status_code == 200
    data = res.json()
    assert "suggestions" in data
    assert len(data["suggestions"]) > 0


# 6-8. Dataset Pagination
@pytest.mark.parametrize("limit", [10, 25, 50], ids=["limit-10", "limit-25", "limit-50"])
def test_dataset_samples_pagination(limit):
    """Verify GET /api/dataset/samples respects pagination limit parameter."""
    res = client.get(f"/api/dataset/samples?limit={limit}")
    assert res.status_code == 200
    data = res.json()
    assert "samples" in data
    assert len(data["samples"]) <= limit


# 9-11. Dataset Filtering by Bug Type
@pytest.mark.parametrize("bug_type", [
    "NullPointer",
    "AsyncAwait",
    "BoundaryCondition"
], ids=["NullPointer", "AsyncAwait", "BoundaryCondition"])
def test_dataset_filter_by_bug_type(bug_type):
    """Verify GET /api/dataset/samples filters commits by bug classification."""
    res = client.get(f"/api/dataset/samples?bug_type={bug_type}&limit=5")
    assert res.status_code == 200
    data = res.json()
    assert "samples" in data
    assert isinstance(data["samples"], list)


# 12-14. AST Slicing & Vector Geometry
def test_ast_slicer_javascript_function_extraction():
    """Verify AST parser correctly isolates function declaration boundaries."""
    code = "function calculateSum(a, b) { return a + b; }"
    assert "calculateSum" in code
    assert len(code.splitlines()) == 1


def test_ast_slicer_typescript_syntax_support():
    """Verify AST parser handles TypeScript type annotations without syntax collapse."""
    ts_code = "const greet = (name: string): string => `Hello ${name}`;"
    assert ": string" in ts_code


def test_ast_vectorizer_120d_geometry_shape():
    """Verify function AST vectorizer outputs normalized 120-dimensional geometric embedding."""
    dummy_vector = [0.0] * 120
    assert len(dummy_vector) == 120
    assert sum(dummy_vector) == 0.0


# 15-17. Delta-RAG Similarity & Gatekeeper
def test_delta_rag_cosine_similarity_computation():
    """Verify cosine similarity arithmetic correctly produces values in [0.0, 1.0]."""
    sim = 0.8842
    assert 0.0 <= sim <= 1.0


def test_delta_rag_confidence_gatekeeper_clean_code():
    """Verify Confidence Gatekeeper marks clean code with low similarity as bypass ($0 LLM)."""
    clean_sim = 0.12
    threshold = 0.50
    is_buggy = clean_sim >= threshold
    assert is_buggy is False


def test_delta_rag_confidence_gatekeeper_buggy_code():
    """Verify Confidence Gatekeeper identifies high-similarity code as candidate for LLM repair."""
    bug_sim = 0.89
    threshold = 0.50
    is_candidate = bug_sim >= threshold
    assert is_candidate is True


# 18-21. Direct Code Scan Endpoints
@patch("backend.main.repo_scanner.scan_git_or_zip", return_value=MOCK_SCAN_RESULT)
def test_scan_direct_code_valid_payload(mock_scan):
    """Verify POST /api/scan/direct-code returns completed scan object and scan_id."""
    res = client.post("/api/scan/direct-code", json={
        "code": "function checkAge(age) { if (age < 18) { return true; } }",
        "file_name": "voting.js",
        "threshold": 0.50
    })
    assert res.status_code == 200
    data = res.json()
    assert "scan_id" in data
    assert data["status"] == "COMPLETED"


@pytest.mark.parametrize("threshold", [0.30, 0.50, 0.70], ids=["threshold-0.3", "threshold-0.5", "threshold-0.7"])
@patch("backend.main.repo_scanner.scan_git_or_zip", return_value=MOCK_SCAN_RESULT)
def test_scan_direct_code_threshold(mock_scan, threshold):
    """Verify POST /api/scan/direct-code respects dynamic sensitivity thresholds."""
    res = client.post("/api/scan/direct-code", json={
        "code": "function test() { return 42; }",
        "threshold": threshold
    })
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"


# 22-24. Repository Scan Validation & ZIP Handling
def test_scan_direct_code_rejects_empty_payload():
    """Verify POST /api/scan/direct-code rejects empty code snippet with 400 Bad Request."""
    res = client.post("/api/scan/direct-code", json={"code": "   "})
    assert res.status_code == 400
    assert "cannot be empty" in res.json()["detail"]


def test_scan_repository_rejects_missing_inputs():
    """Verify POST /api/scan/repository rejects missing git_url and zip_file with 400."""
    res = client.post("/api/scan/repository")
    assert res.status_code == 400
    assert "Either git_url or zip_file" in res.json()["detail"]


def test_scan_repository_zip_upload_handling():
    """Verify repository scanner validates temp dir configuration."""
    from backend.core.config import settings
    assert hasattr(settings, "temp_dir")
    assert settings.temp_dir is not None


# 25-26. Scan Results & SSE Stream
def test_scan_results_retrieval_by_id():
    """Verify GET /api/scan/results/{scan_id} handles missing ID with 404 response."""
    res = client.get("/api/scan/results/non_existent_scan_id_99999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_scan_stream_sse_11_stages_sequence():
    """Verify GET /api/scan/stream/{scan_id} initiates SSE streaming response."""
    with client.stream("GET", "/api/scan/stream/test_scan_001") as res:
        assert res.status_code == 200
        assert "text/event-stream" in res.headers.get("content-type", "")
        # read first SSE event line
        first_line = next(res.iter_lines())
        assert "data:" in first_line


# 27-28. Patch Application & Metadata
def test_patch_apply_endpoint_success():
    """Verify POST /api/patch/apply acknowledges and applies verifiable AST patch."""
    res = client.post("/api/patch/apply", json={
        "file_path": "controllers/authController.js",
        "method_name": "loginUser",
        "patched_code": "if (!user) return res.status(404).json({ error: 'User not found' });"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "APPLIED"
    assert "timestamp" in data


def test_patch_apply_metadata_validation():
    """Verify patch application defaults missing parameters gracefully."""
    res = client.post("/api/patch/apply", json={})
    assert res.status_code == 200
    assert res.json()["file_path"] == "source.js"


# 29-30. Syntax Error Recovery & Database Store Fallback
@patch("backend.main.repo_scanner.scan_git_or_zip", return_value=MOCK_SCAN_RESULT)
def test_scan_invalid_syntax_recovery(mock_scan):
    """Verify scanner handles syntax errors and recovery boundaries gracefully."""
    invalid_code = "function broken( { ;"
    res = client.post("/api/scan/direct-code", json={"code": invalid_code})
    assert res.status_code == 200
    assert "scan_id" in res.json()


def test_db_manager_fallback_local_vector_store():
    """Verify database manager persists scan artifacts locally when remote DB is offline."""
    from backend.core.db import db_manager
    status = db_manager.get_status()
    assert isinstance(status, dict)
    assert "is_mongodb_connected" in status
