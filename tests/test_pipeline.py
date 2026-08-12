from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from build_data import build, month_from_profile  # noqa: E402


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary=tempfile.TemporaryDirectory(); folder=Path(cls.temporary.name)
        cls.payload,cls.audit=build(ROOT,folder/"dashboard.json",folder/"audit.json")

    @classmethod
    def tearDownClass(cls): cls.temporary.cleanup()

    def test_real_coverage(self):
        self.assertGreaterEqual(len(self.payload["directory"]),900)
        self.assertGreaterEqual(self.audit["profile"]["matchedStores"],900)
        self.assertGreaterEqual(self.audit["business"]["matchedStores"],900)
        self.assertGreaterEqual(self.audit["partners"]["matchedStores"],900)
        self.assertGreaterEqual(self.audit["mix"]["matchedStores"],650)

    def test_month_contract(self):
        self.assertEqual([month["period"] for month in self.payload["months"]],[f"2026{month:02d}" for month in range(1,8)])
        self.assertEqual(self.audit["profile"]["monthHeader"],"MES_NUM")
        self.assertEqual(set(self.audit["profile"]["months"]),set(range(1,8)))
        self.assertEqual(len(set(self.audit["profile"]["months"].values())),1)

    def test_month_parser_is_future_proof(self):
        for raw,expected in ((1,1),(12,12),(202601,1),("202612",12),("1_ene",1),("7_jul",7)):
            self.assertEqual(month_from_profile(raw),expected,raw)
        self.assertIsNone(month_from_profile(13))

    def test_minus_100_is_blank(self):
        self.assertGreater(sum(self.audit["profile"]["minus100Blanked"].values()),0)
        headers=self.payload["metricHeaders"]
        for cc,months in self.payload["profile"].items():
            for values in months.values():
                for header in ("VMT","VMT AA","OMT","OMT AA"):
                    self.assertNotEqual(values[headers.index(header)],-1,cc)

    def test_dt_is_seconds(self):
        index=self.payload["metricHeaders"].index("DT Time")
        values=[row[index] for months in self.payload["profile"].values() for row in months.values() if row[index] is not None]
        self.assertTrue(values)
        self.assertTrue(all(20<=value<=1800 for value in values))
        self.assertIn(75.0,values)  # 01:15 = un minuto con quince segundos

    def test_only_verified_keys_are_emitted(self):
        valid_cc={item["cc"] for item in self.payload["directory"]}
        for name in ("profile","business","mix","partners"):
            self.assertTrue(set(self.payload[name]).issubset(valid_cc),name)

    def test_mix_parts_match_manifest_and_fit_github(self):
        manifest=json.loads((ROOT/"data/engines/mix/manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(sum(part["rows"] for part in manifest["parts"]),manifest["rows"])
        self.assertEqual(self.audit["mix"]["sourceRows"],manifest["rows"])
        for part in manifest["parts"]:
            path=ROOT/"data/engines/mix"/part["file"]
            self.assertTrue(path.is_file())
            self.assertLess(path.stat().st_size,25_000_000)

    def test_every_project_file_is_under_25mb(self):
        oversized=[path for path in ROOT.rglob("*") if path.is_file() and "dist" not in path.parts and path.stat().st_size>=25_000_000]
        self.assertEqual(oversized,[])

    def test_static_javascript_is_valid(self):
        completed=subprocess.run(["node","--check",str(ROOT/"app.js")],capture_output=True,text=True)
        self.assertEqual(completed.returncode,0,completed.stderr)

    def test_html_uses_local_assets_only(self):
        class Collector(HTMLParser):
            def __init__(self): super().__init__(); self.urls=[]
            def handle_starttag(self,tag,attrs):
                values=dict(attrs)
                if tag in {"script","link","img"}: self.urls.append(values.get("src") or values.get("href") or "")
        collector=Collector(); collector.feed((ROOT/"index.html").read_text(encoding="utf-8"))
        self.assertTrue(collector.urls)
        self.assertTrue(all(not url.startswith(("http://","https://","//")) for url in collector.urls),collector.urls)

    def test_audit_has_no_blocking_issues(self):
        self.assertEqual(self.audit["issueCount"],0)
        self.assertLessEqual(self.audit["warningCount"],6)


if __name__=="__main__": unittest.main()
