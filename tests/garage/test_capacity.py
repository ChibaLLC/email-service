import importlib.util
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("garage_setup", Path(__file__).resolve().parents[2] / "scripts/garage/setup.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
GIB = 1024 ** 3

class CapacityTest(unittest.TestCase):
    def test_probe_reserves_twenty_percent(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(setup.shutil, "disk_usage", return_value=SimpleNamespace(free=100*GIB)) as probe:
            self.assertEqual(setup.initial_capacity(), 80*GIB)
            probe.assert_called_once_with("/var/lib/garage/data")

    def test_small_disk_reserves_five_gib(self):
        with patch.dict(os.environ, {"GARAGE_CAPACITY_BYTES": ""}, clear=True), patch.object(setup.shutil, "disk_usage", return_value=SimpleNamespace(free=12*GIB+500)):
            self.assertEqual(setup.initial_capacity(), 7*GIB)

    def test_override_does_not_probe(self):
        with patch.dict(os.environ, {"GARAGE_CAPACITY_BYTES": "123456789"}, clear=True), patch.object(setup.shutil, "disk_usage") as probe:
            self.assertEqual(setup.initial_capacity(), 123456789)
            probe.assert_not_called()

    def test_low_space_and_bad_overrides_fail(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(setup.shutil, "disk_usage", return_value=SimpleNamespace(free=5*GIB)):
            with self.assertRaises(RuntimeError):
                setup.initial_capacity()
        for value in ("0", "-1", "invalid"):
            with patch.dict(os.environ, {"GARAGE_CAPACITY_BYTES": value}, clear=True):
                with self.assertRaises(ValueError):
                    setup.initial_capacity()
