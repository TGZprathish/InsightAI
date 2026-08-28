"""Automated privacy test asserting the outbound Claude API payload contains ONLY aggregates.

Verifies:
1. No raw individual row values are sent in the system prompt or user messages.
2. Only statistical summaries (mean, median, std, min, max, outliers, correlations, top-N category counts) are sent.
"""

import json
import pandas as pd
import numpy as np

from app.api.v1.ai_chat import (
    _compute_dataset_summary,
    _build_system_prompt,
    _build_llm_messages,
)


def test_payload_contains_no_raw_row_data():
    # 1. Create a synthetic dataset with sensitive raw row values
    unique_secret_identifier = "SECRET_INDIVIDUAL_RECORD_XYZ_999"
    secret_ssn = "123-45-6789"
    secret_salary = 1234567.89

    data = {
        "user_id": [unique_secret_identifier] + [f"user_{i}" for i in range(1, 100)],
        "ssn": [secret_ssn] + [f"000-00-{i:04d}" for i in range(1, 100)],
        "department": ["Engineering"] * 40 + ["Marketing"] * 30 + ["Sales"] * 20 + ["HR"] * 10,
        "salary": [secret_salary] + [50000 + i * 500 for i in range(1, 100)],
        "tenure_years": [float(i % 10) for i in range(100)],
    }
    df = pd.DataFrame(data)

    # 2. Run computed summary & message construction
    summary = _compute_dataset_summary(
        df=df,
        dataset_name="EmployeeData",
        prompt="What is the average salary and are there any outliers?",
    )
    system_prompt = _build_system_prompt(persona="analyst", mode="chat")
    messages = _build_llm_messages(
        prompt="What is the average salary and are there any outliers?",
        computed_summary=summary,
    )

    # Check intermediate row-level data point (neither min nor max)
    mid_row_salary = 72500.0  # salary at index 45
    raw_row_ssn = "000-00-0045"

    full_payload_text = system_prompt + " " + json.dumps(messages)

    # 3. Assertions: Raw secret strings/values must NEVER appear in outbound payload
    assert unique_secret_identifier not in full_payload_text, "Privacy breach: raw identifier found in LLM payload!"
    assert secret_ssn not in full_payload_text, "Privacy breach: raw SSN found in LLM payload!"
    assert raw_row_ssn not in full_payload_text, "Privacy breach: raw individual SSN found in LLM payload!"
    assert f'"salary": {mid_row_salary}' not in full_payload_text, "Privacy breach: raw row record found directly in LLM payload!"
    assert str(mid_row_salary) not in full_payload_text, "Privacy breach: unaggregated numeric row value found in LLM payload!"

    # 4. Assertions: Summary structure must be aggregated
    assert "stats_summary" in summary
    assert "salary" in summary["stats_summary"]
    salary_stats = summary["stats_summary"]["salary"]
    assert "mean" in salary_stats
    assert "median" in salary_stats
    assert "std" in salary_stats
    assert "min" in salary_stats
    assert "max" in salary_stats
    assert "outliers_count" in salary_stats

    # 5. Assert categorical summary is capped to aggregate counts only (top 5 max)
    assert "department" in summary["categorical_summary"]
    dept_summary = summary["categorical_summary"]["department"]
    assert "value_counts" in dept_summary
    assert dept_summary["value_counts"]["Engineering"] == 40
    assert len(dept_summary["value_counts"]) <= 5


def test_payload_shape_and_keys():
    df = pd.DataFrame({
        "revenue": np.random.normal(1000, 100, 50),
        "cost": np.random.normal(600, 50, 50),
        "region": ["North", "South", "East", "West", "Central"] * 10,
    })
    summary = _compute_dataset_summary(df, "SalesQ4", "Analyze performance")
    messages = _build_llm_messages("Analyze performance", summary)

    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert "## Dataset Statistical Summary" in messages[0]["content"]
    assert "## User Question" in messages[0]["content"]

    # Verify JSON block inside user content is valid and parseable
    content = messages[0]["content"]
    json_start = content.find("```json\n") + 8
    json_end = content.find("\n```\n\n## User Question")
    json_str = content[json_start:json_end]
    parsed = json.loads(json_str)

    assert parsed["dataset_name"] == "SalesQ4"
    assert parsed["total_rows"] == 50
    assert parsed["total_cols"] == 3
    assert len(parsed["correlations"]) > 0
