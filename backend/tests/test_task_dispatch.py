import os
import sys
sys.path.insert(0, os.path.abspath("."))

import unittest
from unittest.mock import MagicMock, patch
import uuid


class TestTaskDispatch(unittest.TestCase):

    @patch("app.tasks.profiling.profile_dataset_task.delay")
    def test_profiling_task_dispatch(self, mock_delay):
        from app.tasks.profiling import profile_dataset_task
        dummy_id = str(uuid.uuid4())
        profile_dataset_task.delay(dummy_id)
        mock_delay.assert_called_once_with(dummy_id)

    @patch("app.tasks.ingestion.parse_and_infer_schema.delay")
    def test_ingestion_task_dispatch(self, mock_delay):
        from app.tasks.ingestion import parse_and_infer_schema
        dummy_id = str(uuid.uuid4())
        parse_and_infer_schema.delay(dummy_id)
        mock_delay.assert_called_once_with(dummy_id)

    @patch("app.tasks.analysis.run_analysis_task.delay")
    def test_analysis_task_dispatch(self, mock_delay):
        from app.tasks.analysis import run_analysis_task
        dummy_id = str(uuid.uuid4())
        run_analysis_task.delay(dummy_id)
        mock_delay.assert_called_once_with(dummy_id)

    @patch("app.tasks.ml.train_ml_model_task.delay")
    def test_ml_task_dispatch(self, mock_delay):
        from app.tasks.ml import train_ml_model_task
        dummy_id = str(uuid.uuid4())
        train_ml_model_task.delay(dummy_id)
        mock_delay.assert_called_once_with(dummy_id)

    @patch("app.tasks.cleaning.apply_cleaning_job.delay")
    def test_cleaning_task_dispatch(self, mock_delay):
        from app.tasks.cleaning import apply_cleaning_job
        dummy_id = str(uuid.uuid4())
        apply_cleaning_job.delay(dummy_id)
        mock_delay.assert_called_once_with(dummy_id)

    @patch("app.tasks.reports.export_report_pdf_task.delay")
    def test_reports_task_dispatch(self, mock_delay):
        from app.tasks.reports import export_report_pdf_task
        dummy_id = str(uuid.uuid4())
        export_report_pdf_task.delay(dummy_id)
        mock_delay.assert_called_once_with(dummy_id)


if __name__ == "__main__":
    unittest.main()
