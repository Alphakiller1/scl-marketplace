import importlib.util
from collections import Counter
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("extract-legacy-mysql.py")
SPEC = importlib.util.spec_from_file_location("extract_legacy_mysql", MODULE_PATH)
extractor = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(extractor)


class PreImportEntriesTest(unittest.TestCase):
    def test_uses_one_calendar_year_instead_of_mixed_sport_seasons(self):
        account = "114"
        scoped = {
            "CURRENT_YEAR": {
                account: {
                    "TOT_w": "10",
                    "TOT_l": "5",
                    "TOT_p": "1",
                    "TOT_ur": "32.00",
                    "TOT_ue": "4.50",
                }
            },
            "CURRENT_SEASON": {
                account: {
                    "TOT_w": "54",
                    "TOT_l": "65",
                    "TOT_p": "3",
                    "TOT_ur": "388.77",
                    "TOT_ue": "-59.59",
                }
            },
        }
        imported = [
            {
                "sport": "MLB",
                "outcome": "WIN",
                "units": 2.0,
                "profitUnits": 2.0,
            }
        ]

        rows = extractor.pre_import_entries(
            scoped, account, imported, Counter()
        )

        self.assertEqual(
            rows,
            [
                {
                    "scope": "PRE_IMPORT",
                    "sport": "ALL",
                    "wins": 9,
                    "losses": 5,
                    "pushes": 1,
                    "unitsRisked": 30.0,
                    "unitsNet": 2.5,
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
